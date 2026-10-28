// One line-icon set for the interface (Lucide). Emojis stay in what people write: plan titles,
// comments and the emojis they leave on them.
import {
  Briefcase,
  Cake,
  Coffee,
  Gift,
  Heart,
  House,
  Lock,
  NotebookPen,
  PartyPopper,
  Plane,
  Smile,
  Sparkles,
  Users,
} from 'lucide-react'

export const TAG_ICONS = { date: Heart, plan: NotebookPen, is: Briefcase, tatil: Plane, ozel: PartyPopper }

// A "date" between friends or family is a meetup, as in tagLabel/tagEmoji.
export const tagIcon = (tag, relation = 'partner') =>
  tag === 'date' && relation !== 'partner' ? Coffee : (TAG_ICONS[tag] ?? NotebookPen)

export const RELATION_ICONS = { partner: Heart, friend: Smile, sibling: Users, family: House }

export const WISH_ICONS = { gift: Gift, travel: Plane, experience: Sparkles }

// What a plan card shows when its own category is not the point.
export const SPECIAL_ICONS = { surprise: Gift, milestone: Sparkles, busy: Lock, birthday: Cake }
