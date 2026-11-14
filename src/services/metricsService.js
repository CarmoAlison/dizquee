// Métricas do dashboard (RPCs no banco; nada é contado no front)
import { supabase } from './supabaseClient'

async function rpc(name, params) {
  const { data, error } = await supabase.rpc(name, params)
  if (error) throw error
  return data
}

export const getMetricsSummary = () => rpc('admin_metrics_summary')
export const getSignupsPerDay = (days = 30) => rpc('admin_signups_per_day', { p_days: days })
export const getTopPosts = (metric = 'likes', limit = 5) => rpc('admin_top_posts', { p_metric: metric, p_limit: limit })
export const getTopStories = (limit = 5) => rpc('admin_top_stories', { p_limit: limit })
export const getRecentActivity = (limit = 15) => rpc('admin_recent_activity', { p_limit: limit })
