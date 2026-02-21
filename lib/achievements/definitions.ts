/**
 * Achievement definitions for the ShelfArc gamification system.
 * Each key maps to a displayable achievement shown on the user's profile.
 * @source
 */
export const ACHIEVEMENTS = {
  first_series: {
    title: "First Chapter",
    description: "Created your first series.",
    emoji: "📖"
  },
  first_volume: {
    title: "First Volume",
    description: "Added your first volume to your library.",
    emoji: "📚"
  },
  bookworm: {
    title: "Bookworm",
    description: "Own 10 or more volumes.",
    emoji: "🐛"
  },
  collector: {
    title: "Collector",
    description: "Own 50 or more volumes.",
    emoji: "🗃️"
  },
  centurion: {
    title: "Centurion",
    description: "Own 100 or more volumes.",
    emoji: "💯"
  },
  avid_reader: {
    title: "Avid Reader",
    description: "Completed reading 10 or more volumes.",
    emoji: "🎓"
  },
  series_complete: {
    title: "Series Complete",
    description: "Completed all owned volumes in at least one series.",
    emoji: "🏆"
  }
} as const

export type AchievementId = keyof typeof ACHIEVEMENTS
