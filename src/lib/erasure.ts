import "server-only";
import type { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

/**
 * GDPR szerinti végleges törlés: a munkavállaló összes kapcsolódó rekordja a többi modulból.
 * A HR-dokumentumok és a be-/kilépési folyamatok törlődnek, a jelöltről csak a hivatkozás tűnik el.
 * A HR-napló bejegyzései nem tartalmaznak személyes adatot, ezért megmaradnak (elszámoltathatóság).
 */
export async function eraseEmployeeRecords(employeeId: ObjectId) {
  const db = await getDb();
  const id = String(employeeId);
  const results = await Promise.allSettled([
    db.collection("hr_documents").deleteMany({ employeeId }),
    db.collection("hr_processes").deleteMany({ employeeId }),
    db.collection("candidates").updateMany({ employeeId }, { $unset: { employeeId: "" } }),
    db.collection("absences").deleteMany({ $or: [{ employeeId }, { employeeId: id }] }),
    db.collection<{ _id: string }>("leave_allowances").deleteMany({ _id: { $regex: `^${id}:` } }),
    db.collection("trainings").updateMany(
      { $or: [{ "participants.employeeId": employeeId }, { "participants.employeeId": id }] },
      { $pull: { participants: { employeeId: { $in: [employeeId, id] } } } } as never,
    ),
  ]);
  const failed = results.filter((result) => result.status === "rejected").length;
  if (failed) console.error("GDPR-törlés: %d gyűjtemény törlése nem sikerült.", failed);
  return failed === 0;
}
