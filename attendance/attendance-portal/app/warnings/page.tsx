"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import MainMenu from "@/components/MainMenu";
import { createClient } from "@/lib/supabase";

type Employee = {
  id: string;
  employee_code: string;
  full_name: string;
  department: string | null;
  designation: string | null;
};

type WarningLetter = {
  id: string;
  employee_id: string;
  warning_type: string;
  warning_level: string;
  incident_date: string;
  description: string;
  corrective_action: string | null;
  status: string;
  created_by: string;
  created_at: string;
  employees?: Employee | null;
};

type Lang = "en" | "hi" | "mr";

const WARNING_TYPES = [
  {
    value: "LATE_COMING",
    en: "Late Coming",
    hi: "देर से आना",
    mr: "उशिरा येणे",
  },
  {
    value: "UNAUTHORIZED_ABSENCE",
    en: "Unauthorized Absence",
    hi: "बिना अनुमति अनुपस्थिति",
    mr: "परवानगीशिवाय गैरहजर",
  },
  {
    value: "ATTENDANCE",
    en: "Attendance Issue",
    hi: "हाजिरी समस्या",
    mr: "हजेरी समस्या",
  },
  {
    value: "MISPUNCH",
    en: "Mispunch",
    hi: "गलत पंच",
    mr: "चुकीचा पंच",
  },
  {
    value: "PERFORMANCE",
    en: "Performance Issue",
    hi: "कार्य प्रदर्शन",
    mr: "कामगिरी समस्या",
  },
  {
    value: "BEHAVIOUR",
    en: "Behaviour Issue",
    hi: "व्यवहार समस्या",
    mr: "वर्तन समस्या",
  },
  {
    value: "SAFETY_VIOLATION",
    en: "Safety Violation",
    hi: "सुरक्षा उल्लंघन",
    mr: "सुरक्षा उल्लंघन",
  },
  {
    value: "OTHER",
    en: "Other",
    hi: "अन्य",
    mr: "इतर",
  },
];

const WARNING_LEVELS = [
  {
    value: "VERBAL",
    en: "Verbal Warning",
    hi: "मौखिक चेतावनी",
    mr: "तोंडी इशारा",
  },
  {
    value: "FIRST_WARNING",
    en: "First Written Warning",
    hi: "पहली लिखित चेतावनी",
    mr: "पहिला लेखी इशारा",
  },
  {
    value: "SECOND_WARNING",
    en: "Second Written Warning",
    hi: "दूसरी लिखित चेतावनी",
    mr: "दुसरा लेखी इशारा",
  },
  {
    value: "FINAL_WARNING",
    en: "Final Warning",
    hi: "अंतिम चेतावनी",
    mr: "अंतिम इशारा",
  },
];

const STATUS_OPTIONS = [
  {
    value: "ACTIVE",
    en: "Active",
    hi: "सक्रिय",
    mr: "सक्रिय",
  },
  {
    value: "RESOLVED",
    en: "Resolved",
    hi: "हल",
    mr: "सोडवले",
  },
  {
    value: "CLOSED",
    en: "Closed",
    hi: "बंद",
    mr: "बंद",
  },
];

const CASES: Record<
  string,
  { key: string; en: string; hi: string; mr: string }[]
> = {
  LATE_COMING: [
    {
      key: "late_3_times",
      en: "Reported late to duty on multiple occasions",
      hi: "कई बार ड्यूटी पर देर से पहुंचे",
      mr: "अनेक वेळा ड्युटीवर उशिरा आले",
    },
    {
      key: "late_no_permission",
      en: "Came late without prior permission",
      hi: "बिना अनुमति देर से आए",
      mr: "परवानगीशिवाय उशिरा आले",
    },
    {
      key: "late_after_break",
      en: "Returned late after break",
      hi: "ब्रेक के बाद देर से लौटे",
      mr: "ब्रेकनंतर उशिरा परत आले",
    },
  ],

  UNAUTHORIZED_ABSENCE: [
    {
      key: "absent_no_leave",
      en: "Remained absent without approved leave",
      hi: "बिना मंजूरी छुट्टी के अनुपस्थित रहे",
      mr: "मंजूर रजेशिवाय गैरहजर राहिले",
    },
    {
      key: "left_early",
      en: "Left workplace early without permission",
      hi: "बिना अनुमति जल्दी चले गए",
      mr: "परवानगीशिवाय लवकर निघाले",
    },
    {
      key: "no_inform",
      en: "Did not inform supervisor about absence",
      hi: "अनुपस्थिति की जानकारी सुपरवाइजर को नहीं दी",
      mr: "गैरहजेरीबद्दल पर्यवेक्षकांना कळवले नाही",
    },
  ],

  ATTENDANCE: [
    {
      key: "irregular",
      en: "Irregular attendance pattern observed",
      hi: "अनियमित हाजिरी पाई गई",
      mr: "अनियमित हजेरी आढळली",
    },
    {
      key: "frequent_leave",
      en: "Frequent unplanned leaves",
      hi: "बार-बार बिना योजना के छुट्टी",
      mr: "वारंवार अनियोजित रजा",
    },
  ],

  MISPUNCH: [
    {
      key: "missed_punch",
      en: "Failed to punch attendance correctly",
      hi: "हाजिरी सही से पंच नहीं की",
      mr: "हजेरी योग्यरीत्या पंच केली नाही",
    },
    {
      key: "proxy_punch",
      en: "Suspected proxy punch / wrong punch",
      hi: "गलत / प्रॉक्सी पंच की आशंका",
      mr: "चुकीचा / प्रॉक्सी पंच शक्यता",
    },
  ],

  PERFORMANCE: [
    {
      key: "low_output",
      en: "Work output below expected standard",
      hi: "कार्य आउटपुट अपेक्षित स्तर से कम",
      mr: "कामाचे आउटपुट अपेक्षित पातळीपेक्षा कमी",
    },
    {
      key: "repeated_mistakes",
      en: "Repeated operational mistakes",
      hi: "बार-बार परिचालन गलतियां",
      mr: "वारंवार कार्यरत चुका",
    },
    {
      key: "quality_issue",
      en: "Quality of work not satisfactory",
      hi: "काम की गुणवत्ता संतोषजनक नहीं",
      mr: "कामाची गुणवत्ता समाधानकारक नाही",
    },
  ],

  BEHAVIOUR: [
    {
      key: "rude",
      en: "Used inappropriate language / behaviour",
      hi: "अनुचित भाषा / व्यवहार का उपयोग",
      mr: "अयोग्य भाषा / वर्तन वापरले",
    },
    {
      key: "argument",
      en: "Entered into argument with colleague / supervisor",
      hi: "सहकर्मी / सुपरवाइजर से बहस की",
      mr: "सहकारी / पर्यवेक्षकांशी वाद झाला",
    },
    {
      key: "not_following",
      en: "Not following instructions of supervisor",
      hi: "सुपरवाइजर के निर्देशों का पालन नहीं किया",
      mr: "पर्यवेक्षकांच्या सूचनांचे पालन केले नाही",
    },
  ],

  SAFETY_VIOLATION: [
    {
      key: "no_ppe",
      en: "Did not use required safety equipment",
      hi: "आवश्यक सुरक्षा उपकरण नहीं पहने",
      mr: "आवश्यक सुरक्षा उपकरणे वापरली नाहीत",
    },
    {
      key: "unsafe_act",
      en: "Performed unsafe act on duty",
      hi: "ड्यूटी पर असुरक्षित कार्य किया",
      mr: "ड्युटीवर असुरक्षित कृती केली",
    },
  ],

  OTHER: [
    {
      key: "other_general",
      en: "Other disciplinary concern",
      hi: "अन्य अनुशासनात्मक मुद्दा",
      mr: "इतर शिस्तभंगाचा मुद्दा",
    },
  ],
};

const CORRECTIVE_OPTIONS = [
  {
    key: "improve_punctuality",
    en: "Improve punctuality and report on time",
    hi: "समय की पाबंदी सुधारें और समय पर आएं",
    mr: "वेळेचे पालन सुधारा आणि वेळेवर या",
  },
  {
    key: "follow_rules",
    en: "Strictly follow company rules and instructions",
    hi: "कंपनी नियमों और निर्देशों का सख्ती से पालन करें",
    mr: "कंपनी नियम व सूचनांचे काटेकोर पालन करा",
  },
  {
    key: "improve_performance",
    en: "Improve work performance and quality",
    hi: "कार्य प्रदर्शन और गुणवत्ता सुधारें",
    mr: "कामगिरी आणि गुणवत्ता सुधारा",
  },
  {
    key: "maintain_discipline",
    en: "Maintain proper discipline and behaviour",
    hi: "उचित अनुशासन और व्यवहार बनाए रखें",
    mr: "योग्य शिस्त व वर्तन राखा",
  },
  {
    key: "follow_safety",
    en: "Always follow safety guidelines",
    hi: "हमेशा सुरक्षा दिशानिर्देशों का पालन करें",
    mr: "नेहमी सुरक्षा मार्गदर्शक तत्त्वांचे पालन करा",
  },
];

const PRINT = {
  en: {
    title: "WARNING LETTER",
    date: "Date",
    to: "To",
    empCode: "Employee Code",
    dept: "Department",
    desig: "Designation",
    subject: "Subject",
    body1:
      "This letter is issued to formally record the following incident concerning your conduct / performance:",
    incident: "Particulars of Incident",
    level: "Warning Level",
    corrective:
      "You are hereby directed to take the following corrective action:",
    note:
      "You are advised to ensure that such incidents are not repeated in future. Any further occurrence may lead to stricter disciplinary action as per company policy.",
    closing:
      "This letter is issued for your information and necessary compliance.",
    issuedBy: "Issued by",
    sign: "Authorized Signatory",
  },

  hi: {
    title: "चेतावनी पत्र",
    date: "तारीख",
    to: "प्रति",
    empCode: "कर्मचारी कोड",
    dept: "विभाग",
    desig: "पद",
    subject: "विषय",
    body1:
      "यह पत्र आपके आचरण / प्रदर्शन से संबंधित निम्नलिखित घटना को औपचारिक रूप से दर्ज करने के लिए जारी किया गया है:",
    incident: "घटना का विवरण",
    level: "चेतावनी का स्तर",
    corrective:
      "आपको निम्नलिखित सुधारात्मक कार्रवाई करने का निर्देश दिया जाता है:",
    note:
      "आपसे अनुरोध है कि भविष्य में ऐसी घटनाएं दोबारा न हों। दोबारा होने पर कंपनी नीति के अनुसार कठोर अनुशासनात्मक कार्रवाई की जा सकती है।",
    closing:
      "यह पत्र आपकी जानकारी और आवश्यक अनुपालन के लिए जारी किया गया है।",
    issuedBy: "जारीकर्ता",
    sign: "अधिकृत हस्ताक्षरकर्ता",
  },

  mr: {
    title: "इशारा पत्र",
    date: "तारीख",
    to: "प्रति",
    empCode: "कर्मचारी कोड",
    dept: "विभाग",
    desig: "पद",
    subject: "विषय",
    body1:
      "हे पत्र आपल्या वर्तन / कामगिरीशी संबंधित खालील घटना औपचारिकरित्या नोंदविण्यासाठी जारी करण्यात येत आहे:",
    incident: "घटनेचा तपशील",
    level: "इशाऱ्याचा स्तर",
    corrective:
      "आपल्याला खालील सुधारात्मक कारवाई करण्याचे निर्देश देण्यात येत आहेत:",
    note:
      "कृपया भविष्यात अशा घटना पुन्हा होणार नाहीत याची काळजी घ्या. पुन्हा घडल्यास कंपनी धोरणानुसार कठोर शिस्तभंगाची कारवाई होऊ शकते.",
    closing:
      "हे पत्र आपल्या माहिती व आवश्यक अनुपालनासाठी जारी करण्यात येत आहे.",
    issuedBy: "जारीकर्ता",
    sign: "अधिकृत सही",
  },
};

function formatDate(d?: string | null) {
  if (!d) return "-";

  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(d));
  } catch {
    return d;
  }
}

function formatDateTime(d?: string | null) {
  if (!d) return "-";

  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(d));
  } catch {
    return d;
  }
}

function label(
  list: { value: string; en: string; hi?: string; mr?: string }[],
  value: string,
  lang: Lang = "en"
) {
  const item = list.find((x) => x.value === value);

  if (!item) return value;

  return (item as any)[lang] || item.en;
}

function caseLabel(type: string, key: string, lang: Lang) {
  const list = CASES[type] || [];
  const item = list.find((x) => x.key === key);

  if (!item) return key;

  return item[lang] || item.en;
}

function correctiveLabel(key: string, lang: Lang) {
  const item = CORRECTIVE_OPTIONS.find((x) => x.key === key);

  if (!item) return key;

  return item[lang] || item.en;
}

function getLevelStyle(level: string) {
  switch (level) {
    case "FINAL_WARNING":
      return "border-red-200 bg-red-50 text-red-700";

    case "SECOND_WARNING":
      return "border-orange-200 bg-orange-50 text-orange-700";

    case "FIRST_WARNING":
      return "border-amber-200 bg-amber-50 text-amber-700";

    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function getStatusStyle(status: string) {
  switch (status) {
    case "ACTIVE":
      return "border-blue-200 bg-blue-50 text-blue-700";

    case "RESOLVED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "CLOSED":
      return "border-slate-200 bg-slate-50 text-slate-600";

    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export default function WarningsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [warnings, setWarnings] = useState<WarningLetter[]>([]);

  const [profile, setProfile] = useState<{
    username: string;
    role: string;
    can_warnings?: boolean;
  } | null>(null);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [filterLevel, setFilterLevel] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterDept, setFilterDept] = useState("ALL");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<WarningLetter | null>(null);
  const [viewing, setViewing] = useState<WarningLetter | null>(null);
  const [showPrint, setShowPrint] = useState(false);
  const [printLang, setPrintLang] = useState<Lang>("en");

  const [selectedEmployee, setSelectedEmployee] =
    useState<Employee | null>(null);

  const [empSearch, setEmpSearch] = useState("");

  const [warningType, setWarningType] = useState("");
  const [warningLevel, setWarningLevel] = useState("");

  const [incidentDate, setIncidentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [caseKey, setCaseKey] = useState("");
  const [correctiveKey, setCorrectiveKey] = useState("");
  const [status, setStatus] = useState("ACTIVE");

  const role = (profile?.role || "").toLowerCase();

  const isAdmin =
    role === "admin" ||
    role === "administrator";

  const isManager = role === "manager";

  const canAccess =
    isAdmin ||
    isManager ||
    profile?.can_warnings === true;

  const currentUsername = profile?.username || "";

  /*
   * EDIT PERMISSION
   *
   * Admin    → edit everyone
   * Manager  → edit everyone
   * Others   → edit only own warnings
   */
  function canEdit(w: WarningLetter) {
    if (isAdmin || isManager) return true;

    return (
      !!currentUsername &&
      w.created_by.toLowerCase() === currentUsername.toLowerCase()
    );
  }

  /*
   * DELETE PERMISSION
   *
   * Admin only.
   */
  function canDelete() {
    return isAdmin;
  }

  const caseOptions = useMemo(
    () => (warningType ? CASES[warningType] || [] : []),
    [warningType]
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Session not found");
        return;
      }

      const username =
        user.email?.replace("@attendance.local", "").toLowerCase() || "";

      const { data: staff, error: staffError } = await supabase
        .from("staff_profiles")
        .select("username, role, can_warnings")
        .eq("username", username)
        .maybeSingle();

      if (staffError) throw staffError;

      setProfile(staff);

      const { data: empData, error: empError } = await supabase
        .from("employees")
        .select(
          "id, employee_code, full_name, department, designation"
        )
        .eq("is_active", true)
        .order("full_name");

      if (empError) throw empError;

      setEmployees(empData || []);

      const { data: warnData, error: wErr } = await supabase
        .from("warning_letters")
        .select(
          `
          id,
          employee_id,
          warning_type,
          warning_level,
          incident_date,
          description,
          corrective_action,
          status,
          created_by,
          created_at,
          employees (
            id,
            employee_code,
            full_name,
            department,
            designation
          )
        `
        )
        .order("created_at", {
          ascending: false,
        });

      if (wErr) throw wErr;

      setWarnings(
        (warnData || []).map((w: any) => ({
          ...w,
          employees: Array.isArray(w.employees)
            ? w.employees[0]
            : w.employees,
        }))
      );
    } catch (err: any) {
      console.error("Warning load error:", err);

      setError(
        err?.message ||
          "Unable to load warning letters"
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const departments = useMemo(() => {
    const set = new Set<string>();

    warnings.forEach((w) => {
      if (w.employees?.department) {
        set.add(w.employees.department);
      }
    });

    return Array.from(set).sort();
  }, [warnings]);

  const filteredEmployees = useMemo(() => {
    const q = empSearch.trim().toLowerCase();

    if (!q) {
      return employees.slice(0, 12);
    }

    return employees
      .filter(
        (e) =>
          e.full_name.toLowerCase().includes(q) ||
          e.employee_code.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [employees, empSearch]);

  const filteredWarnings = useMemo(() => {
    const q = search.trim().toLowerCase();

    return warnings.filter((w) => {
      const emp = w.employees;

      const matchQ =
        !q ||
        emp?.full_name?.toLowerCase().includes(q) ||
        emp?.employee_code?.toLowerCase().includes(q);

      const matchDept =
        filterDept === "ALL" ||
        emp?.department === filterDept;

      return (
        matchQ &&
        matchDept &&
        (filterType === "ALL" ||
          w.warning_type === filterType) &&
        (filterLevel === "ALL" ||
          w.warning_level === filterLevel) &&
        (filterStatus === "ALL" ||
          w.status === filterStatus)
      );
    });
  }, [
    warnings,
    search,
    filterType,
    filterLevel,
    filterStatus,
    filterDept,
  ]);

  /*
   * Department-wise segregation.
   */
  const groupedByDept = useMemo(() => {
    const map = new Map<string, WarningLetter[]>();

    filteredWarnings.forEach((w) => {
      const dept =
        w.employees?.department ||
        "Unassigned";

      if (!map.has(dept)) {
        map.set(dept, []);
      }

      map.get(dept)!.push(w);
    });

    return Array.from(map.entries()).sort(
      ([a], [b]) => a.localeCompare(b)
    );
  }, [filteredWarnings]);

  const stats = useMemo(
    () => ({
      total: warnings.length,

      active: warnings.filter(
        (w) => w.status === "ACTIVE"
      ).length,

      first: warnings.filter(
        (w) => w.warning_level === "FIRST_WARNING"
      ).length,

      final: warnings.filter(
        (w) => w.warning_level === "FINAL_WARNING"
      ).length,
    }),
    [warnings]
  );

  function openCreate() {
    setEditing(null);

    setSelectedEmployee(null);
    setEmpSearch("");

    setWarningType("");
    setWarningLevel("");
    setCaseKey("");
    setCorrectiveKey("");

    setIncidentDate(
      new Date().toISOString().slice(0, 10)
    );

    setStatus("ACTIVE");

    setError("");
    setSuccess("");

    setShowForm(true);
  }

  function openEdit(w: WarningLetter) {
    if (!canEdit(w)) {
      setError(
        "You can only edit your own warning letters."
      );

      return;
    }

    setEditing(w);

    const emp =
      employees.find(
        (e) => e.id === w.employee_id
      ) ||
      w.employees ||
      null;

    setSelectedEmployee(emp);

    setEmpSearch(
      emp
        ? `${emp.full_name} (${emp.employee_code})`
        : ""
    );

    setWarningType(w.warning_type);
    setWarningLevel(w.warning_level);
    setCaseKey(w.description || "");
    setCorrectiveKey(
      w.corrective_action || ""
    );

    setIncidentDate(w.incident_date);
    setStatus(w.status);

    setViewing(null);
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (!selectedEmployee) {
        setError("Please select an employee.");
        return;
      }

      if (!warningType) {
        setError("Please select warning type.");
        return;
      }

      if (!warningLevel) {
        setError("Please select warning level.");
        return;
      }

      if (!caseKey) {
        setError("Please select incident case.");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Session not found");
      }

      const username =
        user.email?.replace("@attendance.local", "")
          .toLowerCase() || "";

      const payload = {
        employee_id: selectedEmployee.id,
        warning_type: warningType,
        warning_level: warningLevel,
        incident_date: incidentDate,
        description: caseKey,
        corrective_action:
          correctiveKey || null,
        status,
      };

      /*
       * UPDATE
       *
       * created_by and created_at are intentionally
       * NOT updated.
       */
      if (editing) {
        if (!canEdit(editing)) {
          setError(
            "You do not have permission to edit this warning."
          );

          return;
        }

        const { error } = await supabase
          .from("warning_letters")
          .update(payload)
          .eq("id", editing.id);

        if (error) throw error;

        setSuccess(
          "Warning letter updated successfully."
        );
      } else {
        /*
         * CREATE
         *
         * Username is automatically taken from
         * logged-in account.
         */
        const { error } = await supabase
          .from("warning_letters")
          .insert({
            ...payload,
            created_by: username,
          });

        if (error) throw error;

        setSuccess(
          "Warning letter created successfully."
        );
      }

      await loadData();

      setTimeout(() => {
        setShowForm(false);
        setSuccess("");
      }, 700);
    } catch (err: any) {
      console.error("Warning save error:", err);

      setError(
        err?.message ||
          "Unable to save warning letter."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteWarning(
    w: WarningLetter
  ) {
    if (!isAdmin) {
      setError(
        "Only Admin can delete warning letters."
      );

      return;
    }

    const employeeName =
      w.employees?.full_name ||
      "this employee";

    if (
      !confirm(
        `Delete warning letter for ${employeeName}?`
      )
    ) {
      return;
    }

    try {
      setError("");

      const { error } = await supabase
        .from("warning_letters")
        .delete()
        .eq("id", w.id);

      if (error) throw error;

      setWarnings((prev) =>
        prev.filter((x) => x.id !== w.id)
      );

      setViewing(null);

      setSuccess(
        "Warning letter deleted successfully."
      );

      setTimeout(() => setSuccess(""), 2000);
    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to delete warning letter."
      );
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f6f7f9]">
        <MainMenu />

        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-800" />

            <p className="text-sm text-slate-500">
              Loading warning letters...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!canAccess) {
    return (
      <main className="min-h-screen bg-[#f6f7f9]">
        <MainMenu />

        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              className="text-slate-500"
            >
              <path d="M12 15v2" />
              <path d="M12 3a7 7 0 0 0-7 7v4l-2 3h18l-2-3v-4a7 7 0 0 0-7-7Z" />
            </svg>
          </div>

          <h1 className="mt-5 text-xl font-semibold text-slate-900">
            Access Restricted
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            You don't have permission to access
            warning letters.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-slate-800">
      <MainMenu />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

        {/* ================= HEADER ================= */}
        <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 ring-1 ring-slate-200">
                HR · Discipline
              </span>

              {isAdmin && (
                <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Admin
                </span>
              )}

              {isManager && !isAdmin && (
                <span className="rounded-full bg-slate-700 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Manager
                </span>
              )}
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
              Warning Letters
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Record, review and manage employee
              disciplinary warnings.
            </p>
          </div>

          <button
            onClick={openCreate}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98]"
          >
            <span className="text-lg leading-none">
              +
            </span>

            New Warning
          </button>
        </div>

        {/* ================= ALERTS ================= */}
        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span className="font-semibold">
              Error
            </span>

            <span>{error}</span>

            <button
              onClick={() => setError("")}
              className="ml-auto text-red-400 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <span className="font-semibold">
              Done
            </span>

            <span>{success}</span>
          </div>
        )}

        {/* ================= STATS ================= */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">

          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">
                  Total warnings
                </p>

                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  {stats.total}
                </p>
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                #
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">
                  Active
                </p>

                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  {stats.active}
                </p>
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                ●
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">
                  First warnings
                </p>

                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  {stats.first}
                </p>
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                !
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">
                  Final warnings
                </p>

                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  {stats.final}
                </p>
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600">
                !
              </div>
            </div>
          </div>
        </div>

        {/* ================= FILTER BAR ================= */}
        <div className="mb-6 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70">

          <div className="flex flex-col gap-2 lg:flex-row">

            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                ⌕
              </span>

              <input
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Search employee name or code..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
              />
            </div>

            <select
              value={filterDept}
              onChange={(e) =>
                setFilterDept(e.target.value)
              }
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
            >
              <option value="ALL">
                All Departments
              </option>

              {departments.map((dept) => (
                <option
                  key={dept}
                  value={dept}
                >
                  {dept}
                </option>
              ))}
            </select>

            <select
              value={filterType}
              onChange={(e) =>
                setFilterType(e.target.value)
              }
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
            >
              <option value="ALL">
                All Types
              </option>

              {WARNING_TYPES.map((item) => (
                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.en}
                </option>
              ))}
            </select>

            <select
              value={filterLevel}
              onChange={(e) =>
                setFilterLevel(e.target.value)
              }
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
            >
              <option value="ALL">
                All Levels
              </option>

              {WARNING_LEVELS.map((item) => (
                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.en}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) =>
                setFilterStatus(e.target.value)
              }
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
            >
              <option value="ALL">
                All Status
              </option>

              {STATUS_OPTIONS.map((item) => (
                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.en}
                </option>
              ))}
            </select>

          </div>

          <div className="mt-2 flex items-center justify-between px-1">
            <p className="text-xs text-slate-400">
              Showing{" "}
              <span className="font-semibold text-slate-600">
                {filteredWarnings.length}
              </span>{" "}
              warning
              {filteredWarnings.length !== 1
                ? "s"
                : ""}
            </p>

            {(search ||
              filterDept !== "ALL" ||
              filterType !== "ALL" ||
              filterLevel !== "ALL" ||
              filterStatus !== "ALL") && (
              <button
                onClick={() => {
                  setSearch("");
                  setFilterDept("ALL");
                  setFilterType("ALL");
                  setFilterLevel("ALL");
                  setFilterStatus("ALL");
                }}
                className="text-xs font-medium text-slate-600 hover:text-slate-950"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* ================= DEPARTMENT SECTIONS ================= */}
        <div className="space-y-6">

          {groupedByDept.length === 0 ? (
            <div className="rounded-2xl bg-white px-6 py-20 text-center shadow-sm ring-1 ring-slate-200/70">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-xl text-slate-400">
                —
              </div>

              <h3 className="mt-4 text-sm font-semibold text-slate-800">
                No warning letters found
              </h3>

              <p className="mt-1 text-sm text-slate-400">
                Try changing your filters or create
                a new warning.
              </p>
            </div>
          ) : (
            groupedByDept.map(
              ([dept, rows]) => {

                const activeCount =
                  rows.filter(
                    (w) =>
                      w.status === "ACTIVE"
                  ).length;

                return (
                  <section
                    key={dept}
                    className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70"
                  >

                    {/* Department header */}
                    <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

                      <div className="flex items-center gap-3">

                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-xs font-bold text-white">
                          {dept
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>

                        <div>
                          <h2 className="text-sm font-semibold text-slate-900">
                            {dept}
                          </h2>

                          <p className="mt-0.5 text-xs text-slate-400">
                            {rows.length} warning
                            {rows.length !== 1
                              ? "s"
                              : ""}{" "}
                            · {activeCount} active
                          </p>
                        </div>

                      </div>

                      <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                        Department
                      </span>

                    </div>

                    {/* Desktop table */}
                    <div className="hidden overflow-x-auto md:block">

                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">

                            <th className="px-5 py-3">
                              Employee
                            </th>

                            <th className="px-4 py-3">
                              Warning
                            </th>

                            <th className="px-4 py-3">
                              Level
                            </th>

                            <th className="px-4 py-3">
                              Incident
                            </th>

                            <th className="px-4 py-3">
                              Status
                            </th>

                            <th className="px-4 py-3">
                              Created
                            </th>

                            <th className="px-5 py-3 text-right">
                              Action
                            </th>

                          </tr>
                        </thead>

                        <tbody>

                          {rows.map((w) => (

                            <tr
                              key={w.id}
                              className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50"
                            >

                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">

                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                                    {(
                                      w.employees
                                        ?.full_name ||
                                      "?"
                                    )
                                      .slice(0, 1)
                                      .toUpperCase()}
                                  </div>

                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">
                                      {
                                        w
                                          .employees
                                          ?.full_name
                                      }
                                    </p>

                                    <p className="mt-0.5 text-xs text-slate-400">
                                      {
                                        w
                                          .employees
                                          ?.employee_code
                                      }
                                    </p>
                                  </div>

                                </div>
                              </td>

                              <td className="px-4 py-4">
                                <p className="text-sm font-medium text-slate-700">
                                  {label(
                                    WARNING_TYPES,
                                    w.warning_type
                                  )}
                                </p>
                              </td>

                              <td className="px-4 py-4">
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${getLevelStyle(
                                    w.warning_level
                                  )}`}
                                >
                                  {label(
                                    WARNING_LEVELS,
                                    w.warning_level
                                  )}
                                </span>
                              </td>

                              <td className="max-w-[250px] px-4 py-4">
                                <p className="truncate text-sm text-slate-500">
                                  {caseLabel(
                                    w.warning_type,
                                    w.description,
                                    "en"
                                  )}
                                </p>
                              </td>

                              <td className="px-4 py-4">
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${getStatusStyle(
                                    w.status
                                  )}`}
                                >
                                  {label(
                                    STATUS_OPTIONS,
                                    w.status
                                  )}
                                </span>
                              </td>

                              <td className="px-4 py-4">
                                <p className="text-xs font-medium text-slate-600">
                                  {w.created_by}
                                </p>

                                <p className="mt-0.5 text-[10px] text-slate-400">
                                  {formatDateTime(
                                    w.created_at
                                  )}
                                </p>
                              </td>

                              <td className="px-5 py-4">
                                <div className="flex justify-end gap-1.5">

                                  <button
                                    onClick={() =>
                                      setViewing(w)
                                    }
                                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                                  >
                                    View
                                  </button>

                                  {canEdit(w) && (
                                    <button
                                      onClick={() =>
                                        openEdit(w)
                                      }
                                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                                    >
                                      Edit
                                    </button>
                                  )}

                                  {canDelete() && (
                                    <button
                                      onClick={() =>
                                        deleteWarning(w)
                                      }
                                      className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-red-600 hover:bg-red-50"
                                    >
                                      Delete
                                    </button>
                                  )}

                                </div>
                              </td>

                            </tr>

                          ))}

                        </tbody>
                      </table>

                    </div>

                    {/* Mobile cards */}
                    <div className="divide-y divide-slate-100 md:hidden">

                      {rows.map((w) => (

                        <div
                          key={w.id}
                          className="p-4"
                        >

                          <div className="flex items-start justify-between gap-3">

                            <div className="flex min-w-0 items-center gap-3">

                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                                {(
                                  w.employees
                                    ?.full_name ||
                                  "?"
                                )
                                  .slice(0, 1)
                                  .toUpperCase()}
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {
                                    w
                                      .employees
                                      ?.full_name
                                  }
                                </p>

                                <p className="text-xs text-slate-400">
                                  {
                                    w
                                      .employees
                                      ?.employee_code
                                  }
                                </p>
                              </div>

                            </div>

                            <span
                              className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-semibold ${getLevelStyle(
                                w.warning_level
                              )}`}
                            >
                              {label(
                                WARNING_LEVELS,
                                w.warning_level
                              )}
                            </span>

                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-3">

                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-slate-400">
                                Type
                              </p>

                              <p className="mt-1 text-xs font-medium text-slate-700">
                                {label(
                                  WARNING_TYPES,
                                  w.warning_type
                                )}
                              </p>
                            </div>

                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-slate-400">
                                Status
                              </p>

                              <span
                                className={`mt-1 inline-flex rounded-full border px-2 py-1 text-[9px] font-semibold ${getStatusStyle(
                                  w.status
                                )}`}
                              >
                                {label(
                                  STATUS_OPTIONS,
                                  w.status
                                )}
                              </span>
                            </div>

                          </div>

                          <div className="mt-3 rounded-xl bg-slate-50 p-3">
                            <p className="text-[10px] uppercase tracking-wide text-slate-400">
                              Incident
                            </p>

                            <p className="mt-1 text-xs leading-5 text-slate-600">
                              {caseLabel(
                                w.warning_type,
                                w.description,
                                "en"
                              )}
                            </p>
                          </div>

                          <div className="mt-3 flex items-center justify-between">
                            <div>
                              <p className="text-[10px] text-slate-400">
                                Created by{" "}
                                <span className="font-medium text-slate-600">
                                  {w.created_by}
                                </span>
                              </p>

                              <p className="text-[10px] text-slate-400">
                                {formatDateTime(
                                  w.created_at
                                )}
                              </p>
                            </div>

                            <div className="flex gap-1.5">

                              <button
                                onClick={() =>
                                  setViewing(w)
                                }
                                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-medium"
                              >
                                View
                              </button>

                              {canEdit(w) && (
                                <button
                                  onClick={() =>
                                    openEdit(w)
                                  }
                                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-medium"
                                >
                                  Edit
                                </button>
                              )}

                              {canDelete() && (
                                <button
                                  onClick={() =>
                                    deleteWarning(w)
                                  }
                                  className="rounded-lg border border-red-200 px-2.5 py-1.5 text-[10px] font-medium text-red-600"
                                >
                                  Delete
                                </button>
                              )}

                            </div>
                          </div>

                        </div>

                      ))}

                    </div>

                  </section>
                );
              }
            )
          )}

        </div>
      </div>

      {/* ========================================================= */}
      {/* CREATE / EDIT MODAL                                      */}
      {/* ========================================================= */}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">

          <div className="flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                  HR · Discipline
                </p>

                <h2 className="mt-1 text-lg font-semibold text-slate-950">
                  {editing
                    ? "Edit Warning Letter"
                    : "Create Warning Letter"}
                </h2>

                <p className="mt-0.5 text-xs text-slate-400">
                  Complete the incident details below.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowForm(false)
                }
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>

            </div>

            <form
              onSubmit={handleSubmit}
              className="overflow-y-auto"
            >

              <div className="space-y-5 p-5">

                {/* Employee */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Employee *
                  </label>

                  <div className="relative">

                    <input
                      value={empSearch}
                      onChange={(e) => {
                        setEmpSearch(
                          e.target.value
                        );
                        setSelectedEmployee(null);
                      }}
                      placeholder="Search employee name or code..."
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                    />

                    {!selectedEmployee &&
                      empSearch && (
                        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">

                          {filteredEmployees.length ===
                          0 ? (
                            <div className="px-3 py-4 text-center text-xs text-slate-400">
                              No employee found
                            </div>
                          ) : (
                            filteredEmployees.map(
                              (e) => (
                                <button
                                  key={e.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedEmployee(
                                      e
                                    );

                                    setEmpSearch(
                                      `${e.full_name} (${e.employee_code})`
                                    );
                                  }}
                                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-slate-50"
                                >
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                                    {e.full_name
                                      .slice(0, 1)
                                      .toUpperCase()}
                                  </div>

                                  <div>
                                    <p className="text-xs font-semibold text-slate-800">
                                      {e.full_name}
                                    </p>

                                    <p className="text-[10px] text-slate-400">
                                      {
                                        e.employee_code
                                      }{" "}
                                      ·{" "}
                                      {e.department ||
                                        "No department"}
                                    </p>
                                  </div>
                                </button>
                              )
                            )
                          )}

                        </div>
                      )}

                  </div>

                  {selectedEmployee && (
                    <div className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2.5">

                      <div className="flex items-center justify-between">

                        <div>
                          <p className="text-xs font-semibold text-emerald-800">
                            {selectedEmployee.full_name}
                          </p>

                          <p className="text-[10px] text-emerald-600">
                            {selectedEmployee.employee_code}{" "}
                            ·{" "}
                            {selectedEmployee.department ||
                              "No department"}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEmployee(
                              null
                            );
                            setEmpSearch("");
                          }}
                          className="text-xs text-emerald-500 hover:text-emerald-800"
                        >
                          Change
                        </button>

                      </div>

                    </div>
                  )}
                </div>

                {/* Type + Level */}
                <div className="grid gap-4 sm:grid-cols-2">

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Warning Type *
                    </label>

                    <select
                      value={warningType}
                      onChange={(e) => {
                        setWarningType(
                          e.target.value
                        );
                        setCaseKey("");
                      }}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
                    >
                      <option value="">
                        Select type
                      </option>

                      {WARNING_TYPES.map(
                        (item) => (
                          <option
                            key={item.value}
                            value={item.value}
                          >
                            {item.en}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Warning Level *
                    </label>

                    <select
                      value={warningLevel}
                      onChange={(e) =>
                        setWarningLevel(
                          e.target.value
                        )
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
                    >
                      <option value="">
                        Select level
                      </option>

                      {WARNING_LEVELS.map(
                        (item) => (
                          <option
                            key={item.value}
                            value={item.value}
                          >
                            {item.en}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                </div>

                {/* Incident */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Incident / Mistake *
                  </label>

                  <select
                    value={caseKey}
                    onChange={(e) =>
                      setCaseKey(
                        e.target.value
                      )
                    }
                    disabled={!warningType}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none disabled:bg-slate-50 focus:border-slate-400"
                  >
                    <option value="">
                      {warningType
                        ? "Select incident"
                        : "Select warning type first"}
                    </option>

                    {caseOptions.map(
                      (item) => (
                        <option
                          key={item.key}
                          value={item.key}
                        >
                          {item.en}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* Corrective */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Corrective Action
                  </label>

                  <select
                    value={correctiveKey}
                    onChange={(e) =>
                      setCorrectiveKey(
                        e.target.value
                      )
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
                  >
                    <option value="">
                      Optional
                    </option>

                    {CORRECTIVE_OPTIONS.map(
                      (item) => (
                        <option
                          key={item.key}
                          value={item.key}
                        >
                          {item.en}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* Date + Status */}
                <div className="grid gap-4 sm:grid-cols-2">

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Incident Date *
                    </label>

                    <input
                      type="date"
                      value={incidentDate}
                      onChange={(e) =>
                        setIncidentDate(
                          e.target.value
                        )
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Status
                    </label>

                    <select
                      value={status}
                      onChange={(e) =>
                        setStatus(
                          e.target.value
                        )
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
                    >
                      {STATUS_OPTIONS.map(
                        (item) => (
                          <option
                            key={item.value}
                            value={item.value}
                          >
                            {item.en}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                </div>

                {/* Created by information */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">

                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {editing
                      ? "Original Record"
                      : "Record Information"}
                  </p>

                  <div className="mt-2 grid grid-cols-2 gap-3">

                    <div>
                      <p className="text-[10px] text-slate-400">
                        Created by
                      </p>

                      <p className="mt-0.5 text-xs font-semibold text-slate-700">
                        {editing
                          ? editing.created_by
                          : currentUsername ||
                            "Current user"}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] text-slate-400">
                        Created at
                      </p>

                      <p className="mt-0.5 text-xs font-semibold text-slate-700">
                        {editing
                          ? formatDateTime(
                              editing.created_at
                            )
                          : "Automatically on save"}
                      </p>
                    </div>

                  </div>

                </div>

              </div>

              {/* Footer */}
              <div className="flex gap-2 border-t border-slate-100 bg-slate-50/60 p-4">

                <button
                  type="button"
                  onClick={() =>
                    setShowForm(false)
                  }
                  className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-xl bg-slate-950 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editing
                    ? "Update Warning"
                    : "Create Warning"}
                </button>

              </div>

            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW MODAL                                               */}
      {/* ========================================================= */}

      {viewing && !showPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">

          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">

            <div className="border-b border-slate-100 px-5 py-5">

              <div className="flex items-start justify-between gap-3">

                <div className="flex items-center gap-3">

                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                    {(
                      viewing.employees
                        ?.full_name || "?"
                    )
                      .slice(0, 1)
                      .toUpperCase()}
                  </div>

                  <div>
                    <h2 className="text-base font-semibold text-slate-950">
                      {
                        viewing.employees
                          ?.full_name
                      }
                    </h2>

                    <p className="text-xs text-slate-400">
                      {
                        viewing.employees
                          ?.employee_code
                      }{" "}
                      ·{" "}
                      {
                        viewing.employees
                          ?.department
                      }
                    </p>
                  </div>

                </div>

                <button
                  onClick={() =>
                    setViewing(null)
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  ×
                </button>

              </div>

            </div>

            <div className="space-y-4 p-5">

              <div className="grid grid-cols-2 gap-3">

                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">
                    Warning Type
                  </p>

                  <p className="mt-1 text-xs font-semibold text-slate-800">
                    {label(
                      WARNING_TYPES,
                      viewing.warning_type
                    )}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">
                    Level
                  </p>

                  <span
                    className={`mt-1 inline-flex rounded-full border px-2 py-1 text-[9px] font-semibold ${getLevelStyle(
                      viewing.warning_level
                    )}`}
                  >
                    {label(
                      WARNING_LEVELS,
                      viewing.warning_level
                    )}
                  </span>
                </div>

              </div>

              <div className="rounded-xl border border-slate-200 p-4">

                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Incident
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {caseLabel(
                    viewing.warning_type,
                    viewing.description,
                    "en"
                  )}
                </p>

              </div>

              {viewing.corrective_action && (
                <div className="rounded-xl border border-slate-200 p-4">

                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Corrective Action
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {correctiveLabel(
                      viewing.corrective_action,
                      "en"
                    )}
                  </p>

                </div>
              )}

              <div className="grid grid-cols-2 gap-3">

                <div>
                  <p className="text-[10px] text-slate-400">
                    Incident Date
                  </p>

                  <p className="mt-1 text-xs font-semibold">
                    {formatDate(
                      viewing.incident_date
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] text-slate-400">
                    Status
                  </p>

                  <span
                    className={`mt-1 inline-flex rounded-full border px-2 py-1 text-[9px] font-semibold ${getStatusStyle(
                      viewing.status
                    )}`}
                  >
                    {label(
                      STATUS_OPTIONS,
                      viewing.status
                    )}
                  </span>
                </div>

              </div>

              <div className="border-t border-slate-100 pt-3">

                <p className="text-[10px] text-slate-400">
                  Created by
                </p>

                <p className="text-xs font-semibold text-slate-700">
                  {viewing.created_by}
                </p>

                <p className="mt-0.5 text-[10px] text-slate-400">
                  {formatDateTime(
                    viewing.created_at
                  )}
                </p>

              </div>

            </div>

            <div className="flex gap-2 border-t border-slate-100 bg-slate-50/60 p-4">

              <button
                onClick={() => {
                  setPrintLang("en");
                  setShowPrint(true);
                }}
                className="flex-1 rounded-xl bg-slate-950 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                Print Letter
              </button>

              {canEdit(viewing) && (
                <button
                  onClick={() =>
                    openEdit(viewing)
                  }
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium hover:bg-slate-50"
                >
                  Edit
                </button>
              )}

              {canDelete() && (
                <button
                  onClick={() =>
                    deleteWarning(viewing)
                  }
                  className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              )}

            </div>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PRINT MODAL                                              */}
      {/* ========================================================= */}

      {showPrint && viewing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4">

          <div className="flex max-h-[96vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 print:hidden">

              <div className="flex gap-1">

                {(
                  ["en", "hi", "mr"] as Lang[]
                ).map((l) => (

                  <button
                    key={l}
                    onClick={() =>
                      setPrintLang(l)
                    }
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                      printLang === l
                        ? "bg-slate-950 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {l === "en"
                      ? "English"
                      : l === "hi"
                      ? "हिंदी"
                      : "मराठी"}
                  </button>

                ))}

              </div>

              <div className="flex gap-2">

                <button
                  onClick={() =>
                    window.print()
                  }
                  className="rounded-lg bg-slate-950 px-4 py-1.5 text-sm font-medium text-white"
                >
                  Print Now
                </button>

                <button
                  onClick={() =>
                    setShowPrint(false)
                  }
                  className="rounded-lg border border-slate-200 px-4 py-1.5 text-sm"
                >
                  Close
                </button>

              </div>

            </div>

            <div
              className="overflow-y-auto p-8 sm:p-12"
              id="warning-print"
            >
              {(() => {
                const T = PRINT[printLang];
                const emp = viewing.employees;

                return (
                  <div className="mx-auto max-w-[680px] text-[13px] leading-relaxed text-slate-900">

                    <div className="mb-10 text-center">
                      <h1 className="text-xl font-bold tracking-widest underline underline-offset-4">
                        {T.title}
                      </h1>
                    </div>

                    <div className="mb-6">
                      <p>
                        <span className="font-semibold">
                          {T.date}:
                        </span>{" "}
                        {formatDate(
                          viewing.incident_date
                        )}
                      </p>
                    </div>

                    <div className="mb-6">
                      <p className="font-semibold">
                        {T.to},
                      </p>

                      <p className="mt-2 font-semibold">
                        {emp?.full_name}
                      </p>

                      <p>
                        {T.empCode}:{" "}
                        {emp?.employee_code}
                      </p>

                      <p>
                        {T.dept}:{" "}
                        {emp?.department ||
                          "—"}
                      </p>

                      {emp?.designation && (
                        <p>
                          {T.desig}:{" "}
                          {emp.designation}
                        </p>
                      )}
                    </div>

                    <p className="mb-5">
                      <span className="font-semibold">
                        {T.subject}:
                      </span>{" "}
                      {label(
                        WARNING_TYPES,
                        viewing.warning_type,
                        printLang
                      )}{" "}
                      —{" "}
                      {label(
                        WARNING_LEVELS,
                        viewing.warning_level,
                        printLang
                      )}
                    </p>

                    <p className="mb-5">
                      {T.body1}
                    </p>

                    <div className="mb-5 border border-slate-300 bg-slate-50 px-4 py-4">

                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        {T.incident}
                      </p>

                      <p>
                        {caseLabel(
                          viewing.warning_type,
                          viewing.description,
                          printLang
                        )}
                      </p>

                      <p className="mt-3 text-[11px] text-slate-500">
                        {T.level}:{" "}
                        {label(
                          WARNING_LEVELS,
                          viewing.warning_level,
                          printLang
                        )}
                      </p>

                    </div>

                    {viewing.corrective_action && (
                      <div className="mb-5">

                        <p className="mb-1 font-semibold">
                          {T.corrective}
                        </p>

                        <p>
                          {correctiveLabel(
                            viewing.corrective_action,
                            printLang
                          )}
                        </p>

                      </div>
                    )}

                    <p className="mb-5">
                      {T.note}
                    </p>

                    <p className="mb-12">
                      {T.closing}
                    </p>

                    <div className="mt-16 flex justify-between">

                      <div>
                        <p className="text-slate-500">
                          {T.issuedBy}
                        </p>

                        <p className="mt-1 font-semibold">
                          {viewing.created_by}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="mb-12 text-slate-500">
                          {T.sign}
                        </p>

                        <p className="border-t border-slate-400 pt-1 text-slate-400">
                          ________________
                        </p>
                      </div>

                    </div>

                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PRINT CSS                                                */}
      {/* ========================================================= */}

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }

          #warning-print,
          #warning-print * {
            visibility: visible !important;
          }

          #warning-print {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 30px !important;
            background: white !important;
          }

          @page {
            size: A4;
            margin: 12mm;
          }
        }
      `}</style>
    </main>
  );
}