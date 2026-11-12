import { dayKey } from "@/lib/dates";
import { employeesCsv } from "@/lib/employees-csv";
import { isStatus, listEmployees, type EmployeeQuery } from "@/lib/employees";
import { logChange } from "@/lib/hr-log";
import { requireUser } from "@/lib/session";

/**
 * A munkavállalói lista CSV-ben (UTF-8 BOM, pontosvessző – a magyar Excel így helyesen nyitja meg), az aktuális
 * szűrésnek megfelelően. Csak nem bizalmas mezők; a letöltés a változásnaplóba kerül.
 */
export async function GET(request: Request) {
  const user = await requireUser();
  const params = new URL(request.url).searchParams;
  const status = params.get("status") ?? "";
  const query: EmployeeQuery = {
    q: params.get("q") ?? undefined,
    status: status === "all" ? "all" : isStatus(status) ? status : undefined,
    position: params.get("position") || undefined,
    department: params.get("department") || undefined,
  };
  const list = await listEmployees(query);
  await logChange(user, "employee.export", "employee", `CSV-export: ${list.length} munkavállaló`);
  const name = `munkavallalok-${dayKey(new Date())}.csv`;
  return new Response(employeesCsv(list), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
