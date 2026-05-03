package handlers

// ProjectTypeLabels maps the DB enum to a UI-friendly label. Both backend and
// frontend keep their own copy; if either changes, update both.
var ProjectTypeLabels = map[string]string{
	"INTERNAL_AUDIT":          "Internal Audit & Training",
	"REMOTE_NAV_AUDIT":        "Remote Navigation Audit",
	"INCIDENT_INVESTIGATION":  "Incident Investigation",
	"PRE_PURCHASE_INSPECTION": "Pre-Purchase Inspection",
	"SHIP_RECYCLING_AUDIT":    "Ship Recycling Audit",
}

var StageLabels = map[string]string{
	"ENQUIRY":           "Enquiry",
	"CONFIRMED":         "Confirmed",
	"DATA_COLLECTION":   "Data Collection",
	"ANALYSIS":          "Analysis",
	"REPORT_DRAFT":      "Report Draft",
	"REPORT_SUBMITTED":  "Report Submitted",
	"AWAITING_FEEDBACK": "Awaiting Feedback",
	"COMPLETED":         "Completed",
}

var FileCategoryLabels = map[string]string{
	"RAW_DATA":     "Raw Data",
	"DRAFT_REPORT": "Draft Report",
	"FINAL_REPORT": "Final Report",
	"FEEDBACK":     "Feedback",
	"OTHER":        "Other",
}

var allProjectTypes = []string{
	"INTERNAL_AUDIT",
	"REMOTE_NAV_AUDIT",
	"INCIDENT_INVESTIGATION",
	"PRE_PURCHASE_INSPECTION",
	"SHIP_RECYCLING_AUDIT",
}

var allStages = []string{
	"ENQUIRY",
	"CONFIRMED",
	"DATA_COLLECTION",
	"ANALYSIS",
	"REPORT_DRAFT",
	"REPORT_SUBMITTED",
	"AWAITING_FEEDBACK",
	"COMPLETED",
}

var allFileCategories = []string{
	"RAW_DATA",
	"DRAFT_REPORT",
	"FINAL_REPORT",
	"FEEDBACK",
	"OTHER",
}

func validProjectType(s string) bool { return contains(allProjectTypes, s) }
func validStage(s string) bool       { return contains(allStages, s) }
func validFileCategory(s string) bool {
	if s == "" {
		return false
	}
	return contains(allFileCategories, s)
}

func contains(arr []string, s string) bool {
	for _, v := range arr {
		if v == s {
			return true
		}
	}
	return false
}
