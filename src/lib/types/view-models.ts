// Shapes the UI renders. Database queries map rows into these.
import type {
  ClientStatus,
  InteractionType,
  PropertyStatus,
  TaskPriority,
  clientTypeLabels,
  propertyTypeLabels,
} from "@/lib/i18n/labels";

export type Ref = { id: string; name: string };

export type TaskItem = {
  id: string;
  title: string;
  dueAt: string | null;
  priority: TaskPriority;
  client: Ref | null;
  property: Ref | null;
};

export type ActivityItem = {
  id: string;
  type: InteractionType;
  occurredAt: string;
  summary: string;
  client: Ref | null;
};

export type ClientListItem = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  clientType: keyof typeof clientTypeLabels;
  status: ClientStatus;
  budgetMin: number | null;
  budgetMax: number | null;
  preferredLocations: string[];
  nextFollowUpAt: string | null;
  updatedAt: string;
};

export type PropertyListItem = {
  id: string;
  title: string;
  propertyType: keyof typeof propertyTypeLabels;
  status: PropertyStatus;
  city: string | null;
  district: string | null;
  price: number | null;
  currency: "HUF" | "EUR";
  areaSqm: number | null;
  roomCount: number | null;
  createdAt: string;
};

/** AI recommendation — not a task until the user accepts it. */
/** A suggestion the agent can act on; not a task until accepted. */
export type SuggestionItem = {
  id: string;
  title: string;
  reason: string;
  client: Ref | null;
  property?: Ref | null;
  category?: "strong" | "good" | "possible";
};

export type DashboardData = {
  userFirstName: string | null;
  tasksToday: TaskItem[];
  overdue: TaskItem[];
  activity: ActivityItem[];
  recentProperties: PropertyListItem[];
  recentClients: ClientListItem[];
  suggestions: SuggestionItem[];
  counts: { activeClients: number; activeProperties: number } | null;
};

export type ClientDetail = ClientListItem & {
  notes: string | null;
  createdAt: string;
  lastContactedAt: string | null;
  leadSource: string | null;
  requirements: {
    propertyTypes: string[];
    minRooms: number | null;
    minBedrooms: number | null;
    minAreaSqm: number | null;
    maxAreaSqm: number | null;
    condition: string | null;
    desiredMoveDate: string | null;
    other: string | null;
  };
  aiSummary: { text: string; generatedAt: string } | null;
  interactions: (ActivityItem & { notes: string | null; outcome: string | null; property: Ref | null; source?: string })[];
  tasks: TaskItem[];
  relatedProperties: (PropertyListItem & { relation: string })[];
};
