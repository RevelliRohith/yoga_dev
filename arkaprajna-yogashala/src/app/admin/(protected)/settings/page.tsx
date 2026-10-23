import { loadStudio, operationsWrite } from "@/lib/studio/admin-data";
import { EMPTY_SETTINGS } from "@/lib/studio/model";
import { ManagementHeading } from "../management-ui";
import { StudioForm, SettingsFields } from "../studio-forms";
export default async function Settings() {
  const r = await loadStudio("settings");
  return (
    <>
      <ManagementHeading
        title="Your studio, in your own words."
        description="Manage approved public content, contact details and document footers."
      />
      {r.error && <p className="admin-alert">{r.error}</p>}
      <StudioForm
        kind="settings"
        id="studio"
        version={r.data?.settingsVersion || ""}
        enabled={operationsWrite()}
      >
        <SettingsFields
          settings={r.data?.settings || EMPTY_SETTINGS}
          trainerChoices={r.data?.trainerChoices || []}
        />
      </StudioForm>
    </>
  );
}
