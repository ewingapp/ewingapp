export type ReportMeta = {
  slug: string;
  name: string;
  description: string;
};

export const REPORTS: ReportMeta[] = [
  {
    slug: "doctor",
    name: "Doctor Report",
    description:
      "All appointments for a specified doctor on a specified range of days at a specified office.",
  },
  {
    slug: "appointments-made",
    name: "Appointments Made Report",
    description:
      "All appointments made, canceled, or rescheduled by SSI Schedulers or the Vendor on a specified day.",
  },
  {
    slug: "appointment-slots",
    name: "Appointment Slots Report",
    description:
      "All empty appointment slots for a specific doctor for a range of days.",
  },
  {
    slug: "office-appointment-slots",
    name: "Office Appointment Slots Report",
    description:
      "All empty and filled appointment slots for a specified office on a specified day.",
  },
  {
    slug: "cancellations",
    name: "Cancellation Report",
    description:
      "All cancelled appointments for a specified range of days, with reason and who cancelled.",
  },
  {
    slug: "holes",
    name: "Holes Report",
    description:
      "All doctors that have holes in their schedule for a specified day.",
  },
  {
    slug: "double-book",
    name: "Double Book Report",
    description:
      "All Psych doctors that do No-testing exams that are double-booked for a specified day.",
  },
  {
    slug: "empty-slots",
    name: "Empty Slots Report",
    description:
      "All empty slots for each office for each doctor over a specified range of dates.",
  },
  {
    slug: "kept-no-show",
    name: "Kept and No Show Report",
    description:
      "Count of kept appointments and No-Show appointments for a specific range of days.",
  },
  {
    slug: "total-slots",
    name: "Total Slots and Scheduled Slots Report",
    description:
      "Count of total slots created and total scheduled appointments per doctor for a specific range of days.",
  },
  {
    slug: "kept-appointments",
    name: "Kept Appointments Report",
    description:
      "All kept appointments for a specific range of days. Tracks when the Doctor Report has been received and when it was submitted to the state.",
  },
  {
    slug: "doctor-scheduling",
    name: "Doctor Scheduling Report",
    description:
      "For each active doctor: all created empty appointment slots for a specific range of days, with how many were filled.",
  },
];

export function findReport(slug: string): ReportMeta | undefined {
  return REPORTS.find((r) => r.slug === slug);
}
