import { supabase, supabaseConfigured } from "./supabaseClient.js";
import { MAX_AVATAR_BYTES, AVATAR_TYPES } from "./config.js";

function needSupabase() {
  if (!supabaseConfigured || !supabase) {
    const error = new Error("SUPABASE_NOT_CONFIGURED");
    error.code = "SUPABASE_NOT_CONFIGURED";
    throw error;
  }
}

function resultOrThrow(result) {
  if (result?.error) throw result.error;
  return result?.data;
}

export function isConfigured() {
  return supabaseConfigured;
}

export async function getSession() {
  if (!supabaseConfigured) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session || null;
}

export function onAuthStateChange(callback) {
  if (!supabaseConfigured) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function signUp({ email, password, displayName, city }) {
  needSupabase();
  return resultOrThrow(await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName, city } }
  }));
}

export async function signIn({ email, password }) {
  needSupabase();
  return resultOrThrow(await supabase.auth.signInWithPassword({ email, password }));
}

export async function signOut() {
  needSupabase();
  resultOrThrow(await supabase.auth.signOut());
}

export async function getOwnProfile(userId) {
  needSupabase();
  return resultOrThrow(await supabase
    .from("profiles")
    .select("id,display_name,city,level,dance_role,styles,bio,avatar_url,is_visible,training_match_enabled,created_at,updated_at")
    .eq("id", userId)
    .single());
}

export async function getPublicProfile(userId) {
  needSupabase();
  return resultOrThrow(await supabase
    .from("profiles")
    .select("id,display_name,city,level,dance_role,styles,bio,avatar_url,training_match_enabled")
    .eq("id", userId)
    .eq("is_visible", true)
    .single());
}

export async function updateOwnProfile(userId, payload) {
  needSupabase();
  return resultOrThrow(await supabase
    .from("profiles")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select("id,display_name,city,level,dance_role,styles,bio,avatar_url,is_visible,training_match_enabled,created_at,updated_at")
    .single());
}

export async function uploadAvatar(userId, file) {
  needSupabase();
  if (!AVATAR_TYPES.includes(file.type)) {
    const error = new Error("AVATAR_TYPE");
    error.code = "AVATAR_TYPE";
    throw error;
  }
  if (file.size > MAX_AVATAR_BYTES) {
    const error = new Error("AVATAR_SIZE");
    error.code = "AVATAR_SIZE";
    throw error;
  }
  const path = `${userId}/avatar`;
  const upload = await supabase.storage.from("avatars").upload(path, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: "3600"
  });
  if (upload.error) throw upload.error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

export async function searchPartners({ city = "", styles = [], levels = [], danceRoles = [], broad = false }) {
  needSupabase();
  let query = supabase
    .from("profiles")
    .select("id,display_name,city,level,dance_role,styles,bio,avatar_url,training_match_enabled,updated_at")
    .eq("is_visible", true)
    .limit(broad ? 120 : 50);
  if (city.trim() && !broad) query = query.ilike("city", `%${city.trim()}%`);
  if (styles.length) query = query.overlaps("styles", styles);
  if (levels.length) query = query.in("level", levels);
  if (danceRoles.length) {
    const acceptedRoles = new Set(danceRoles);
    if (danceRoles.includes("Leader") || danceRoles.includes("Follower")) acceptedRoles.add("Les deux");
    query = query.in("dance_role", [...acceptedRoles]);
  }
  return resultOrThrow(await query.order("updated_at", { ascending: false }));
}

export async function listTrainingRequests() {
  needSupabase();
  return resultOrThrow(await supabase
    .from("training_requests")
    .select("id,owner_id,city,event_date,event_time,style,level,note,created_at,owner:profiles!training_requests_owner_id_fkey(id,display_name,avatar_url)")
    .eq("is_active", true)
    .gte("event_date", new Date().toISOString().slice(0, 10))
    .order("event_date", { ascending: true })
    .order("event_time", { ascending: true, nullsFirst: false })
    .limit(40));
}

export async function createTrainingRequest(userId, payload) {
  needSupabase();
  return resultOrThrow(await supabase
    .from("training_requests")
    .insert({ ...payload, owner_id: userId })
    .select("id")
    .single());
}

export async function deleteTrainingRequest(id) {
  needSupabase();
  resultOrThrow(await supabase.from("training_requests").delete().eq("id", id));
}

export async function searchCarpoolOffers({ fromCity = "", destination = "", travelDate = null, peopleCount = 1 }) {
  needSupabase();
  return resultOrThrow(await supabase.rpc("search_carpool_offers", {
    q_from: fromCity.trim() || null,
    q_destination: destination.trim() || null,
    q_date: travelDate || null,
    q_people: Number(peopleCount || 1)
  }));
}

export async function createCarpoolOffer(userId, payload) {
  needSupabase();
  return resultOrThrow(await supabase
    .from("carpool_posts")
    .insert({ ...payload, owner_id: userId, kind: "offer" })
    .select("id")
    .single());
}

export async function deleteCarpoolPost(id) {
  needSupabase();
  resultOrThrow(await supabase.from("carpool_posts").delete().eq("id", id));
}

export async function listMyPosts(userId) {
  needSupabase();
  const [training, carpools] = await Promise.all([
    supabase
      .from("training_requests")
      .select("id,city,event_date,event_time,style,level,note,is_active,created_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("carpool_posts")
      .select("id,kind,from_city,destination,event_name,travel_date,travel_time,seats_available,contribution,note,is_active,created_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
  ]);
  if (training.error) throw training.error;
  if (carpools.error) throw carpools.error;
  return { training: training.data || [], carpools: carpools.data || [] };
}

export async function startConversation(otherUserId) {
  needSupabase();
  return resultOrThrow(await supabase.rpc("start_conversation", { other_user: otherUserId }));
}

export async function listConversations(userId) {
  needSupabase();
  const rows = resultOrThrow(await supabase
    .from("conversations")
    .select("id,participant_a,participant_b,participant_a_hidden,participant_b_hidden,updated_at,profile_a:profiles!conversations_participant_a_fkey(id,display_name,city,avatar_url),profile_b:profiles!conversations_participant_b_fkey(id,display_name,city,avatar_url)")
    .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
    .order("updated_at", { ascending: false }));
  return (rows || []).filter(row => row.participant_a === userId ? !row.participant_a_hidden : !row.participant_b_hidden);
}

export async function listMessages(conversationId) {
  needSupabase();
  return resultOrThrow(await supabase
    .from("messages")
    .select("id,sender_id,body,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(300));
}

export async function sendMessage({ conversationId, senderId, body }) {
  needSupabase();
  return resultOrThrow(await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: senderId, body })
    .select("id,sender_id,body,created_at")
    .single());
}

export function subscribeToMessages(conversationId, callback) {
  if (!supabaseConfigured) return () => {};
  const channel = supabase
    .channel(`kizconnect-conversation-${conversationId}-${crypto.randomUUID()}`)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "messages",
      filter: `conversation_id=eq.${conversationId}`
    }, payload => callback(payload.new))
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export async function hideConversation(conversationId) {
  needSupabase();
  resultOrThrow(await supabase.rpc("hide_conversation", { conversation_uuid: conversationId }));
}

export async function blockUser(userId, blockedUserId) {
  needSupabase();
  resultOrThrow(await supabase.from("blocks").insert({ blocker_id: userId, blocked_user_id: blockedUserId }));
}

export async function unblockUser(userId, blockedUserId) {
  needSupabase();
  resultOrThrow(await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", userId)
    .eq("blocked_user_id", blockedUserId));
}

export async function listBlockedUsers(userId) {
  needSupabase();
  return resultOrThrow(await supabase
    .from("blocks")
    .select("id,blocked_user_id,created_at,profile:profiles!blocks_blocked_user_id_fkey(id,display_name,city,avatar_url)")
    .eq("blocker_id", userId)
    .order("created_at", { ascending: false }));
}

export async function listBlockedIds(userId) {
  if (!userId || !supabaseConfigured) return [];
  const { data, error } = await supabase
    .from("blocks")
    .select("blocked_user_id")
    .eq("blocker_id", userId);
  if (error) return [];
  return (data || []).map(row => row.blocked_user_id);
}


export async function listMyTrainingInterestIds(userId) {
  if (!userId || !supabaseConfigured) return [];
  const { data, error } = await supabase
    .from("training_interests")
    .select("to_user_id")
    .eq("from_user_id", userId);
  if (error) throw error;
  return (data || []).map(row => row.to_user_id);
}

export async function setTrainingInterest(targetUserId, active = true) {
  needSupabase();
  const rows = resultOrThrow(await supabase.rpc("set_training_interest", {
    target_user: targetUserId,
    active
  }));
  return Array.isArray(rows) ? (rows[0] || null) : rows;
}

export async function listTrainingMatches() {
  needSupabase();
  return resultOrThrow(await supabase.rpc("list_training_matches"));
}

export async function submitBetaFeedback({ userId, category, message, appVersion = "3.6.2" }) {
  needSupabase();
  return resultOrThrow(await supabase.rpc("submit_beta_feedback", {
    feedback_category: category,
    feedback_message: message,
    feedback_version: appVersion
  }));
}

export async function reportUser({ reporterId, reportedUserId, category, details }) {
  needSupabase();
  return resultOrThrow(await supabase
    .from("reports")
    .insert({
      reporter_id: reporterId,
      reported_user_id: reportedUserId,
      category,
      details: details || null
    })
    .select("id")
    .single());
}
