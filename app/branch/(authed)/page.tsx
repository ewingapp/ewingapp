import { getActingBranch } from "@/lib/acting-branch";

export default async function BranchHomePage() {
  const actingBranch = await getActingBranch();

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <p className="text-slate-800">
        {actingBranch ? (
          <>
            Welcome Branch{" "}
            <strong className="font-semibold">{actingBranch}</strong> to the
            State website for the Ewing Diagnostics &amp; Psychological Services
            Online Scheduling System.
          </>
        ) : (
          <>
            Welcome to the State website for the Ewing Diagnostics &amp;
            Psychological Services Online Scheduling System. You can schedule
            and look up appointments for any branch.
          </>
        )}
      </p>
      <p className="text-slate-800">
        Below is a description of what you can do within each segment of this
        website. Click the tabs above to go to each of these segments.
      </p>

      <Section
        title="New Appointment"
        body="Go here to create a new appointment."
      />

      <Section
        title="Existing Appointments"
        body="Go here to view appointments that have been created by your Branch."
        note="Go here to view if the appointment was a Show/No Show. Also, you can reschedule or cancel an appointment from here."
      />

      <Section
        title="Vendor Info"
        body="Go here to view information about Ewing Diagnostics & Psychological Services."
      />

      <Section
        title="Support"
        body="Go here to get technical support either by email or by phone."
      />
    </div>
  );
}

function Section({
  title,
  body,
  note,
}: {
  title: string;
  body: string;
  note?: string;
}) {
  return (
    <div>
      <h2 className="font-bold text-slate-900 uppercase tracking-wide">
        {title}
      </h2>
      <p className="text-slate-800">{body}</p>
      {note && (
        <p className="mt-1 text-sm font-semibold text-rose-700">
          <span className="uppercase">Note:</span> {note}
        </p>
      )}
    </div>
  );
}
