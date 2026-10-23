import { requireTrainer } from "@/lib/supabase/trainer";
export default async function TrainerProfilePage() {
  const { profile } = await requireTrainer();
  return <><div className="admin-heading"><div><p className="admin-eyebrow">MY PROFILE</p><h1>{profile.full_name}</h1><p className="admin-muted">Contact the studio administrator to update your details.</p></div></div><section className="management-panel trainer-profile"><dl className="trainer-details">{[["Name", profile.full_name], ["Phone", profile.phone], ["Specialization", profile.specialization], ["Qualifications", profile.qualifications], ["Experience", profile.years_of_experience === null ? null : `${profile.years_of_experience} years`], ["Biography", profile.biography]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "Not provided"}</dd></div>)}</dl></section></>;
}
