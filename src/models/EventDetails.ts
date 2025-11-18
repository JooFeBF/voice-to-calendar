export interface EventDetails {
  event_id?: string;
  title: string;
  start_time: string;
  end_time?: string;
  location?: string;
  description?: string;
  attendees?: string[];
  recurrence?: string[];
  is_recurring?: boolean;
  recurring_event_id?: string;
  update_scope?: RecurringEventUpdateScope;
  delete_scope?: EventDeleteScope;
}

export type EventOperation = 'create' | 'update' | 'delete' | 'no_action';

export type RecurringEventUpdateScope = 'this_event' | 'this_and_following' | 'all_events';

export type EventDeleteScope = 'this_event' | 'all_events';
