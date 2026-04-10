import { REGIONS } from '@veltara/shared';

export function formatClock(progress) {
  const hours = Math.floor((progress * 24) % 24);
  const mins = Math.floor(((progress * 24) % 1) * 60);
  const isDay = progress > 0.25 && progress < 0.75;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${isDay ? '☀' : '☾'}`;
}

export function regionById(regionId) {
  return REGIONS.find((region) => region.id === regionId) ?? REGIONS[0];
}

export function playerName(player) {
  return player?.username ?? player?.name ?? 'Explorer';
}

export function playerAction(player) {
  return player?.action ?? 'idle';
}

export function playerRegion(player) {
  const regionId = player?.region_id ?? player?.regionId ?? player?.region;
  return regionById(regionId)?.name ?? 'Unknown';
}

export function relativeTime(input) {
  if (!input) return 'just now';
  const delta = Date.now() - new Date(input).getTime();
  const seconds = Math.floor(delta / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
