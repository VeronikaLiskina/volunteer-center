import { volunteerStatusLabels, type Volunteer } from "../../types/volunteer";

export function VolunteerDetails({ volunteer }: { volunteer: Pick<Volunteer, "full_name"> & Partial<Volunteer> }) {
  return <div className="volunteer-details">
    <strong>{volunteer.full_name}</strong> · {volunteer.status ? volunteerStatusLabels[volunteer.status] : "Активен"}
    {volunteer.note && <p>Примечание: {volunteer.note}</p>}
    {(volunteer.available_from || volunteer.available_to) && <p>Доступность: {volunteer.available_from?.slice(0, 5) || "00:00"}–{volunteer.available_to?.slice(0, 5) || "24:00"}</p>}
  </div>;
}
