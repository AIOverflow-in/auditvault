package email

import (
	"fmt"
)

// Template returns the (subject, body) pair for a transactional email. All
// templates are plain text — works in any client, easy to read, and no risk
// of broken HTML rendering on the senior user's mail app.
type Template struct {
	Subject string
	Body    string
}

// NewProject — sent to client users with grants on the vessel when Nivyash
// opens a fresh audit.
func NewProject(vesselName, projectTypeLabel, region, proposedDate string) Template {
	when := proposedDate
	if when == "" {
		when = "to be scheduled"
	}
	whereLine := ""
	if region != "" {
		whereLine = "\nLocation:    " + region
	}
	return Template{
		Subject: fmt.Sprintf("New audit project on %s", vesselName),
		Body: fmt.Sprintf(`Hello,

A new audit project has been opened for %s.

Project type: %s%s
Proposed:    %s

You can sign in to AuditVault to follow progress and download reports as they are submitted.

— Nivyash Maritime Consultancy
`, vesselName, projectTypeLabel, whereLine, when),
	}
}

// ReportSubmitted — sent to client users when a project advances to
// REPORT_SUBMITTED. The audit findings are now ready to review.
func ReportSubmitted(vesselName, projectTypeLabel string) Template {
	return Template{
		Subject: fmt.Sprintf("Report ready for review — %s", vesselName),
		Body: fmt.Sprintf(`Hello,

The audit report for %s (%s) has been submitted and is ready for your review on AuditVault.

Sign in to download the report and add any feedback.

— Nivyash Maritime Consultancy
`, vesselName, projectTypeLabel),
	}
}

// ProjectCompleted — sent when stage advances to COMPLETED.
func ProjectCompleted(vesselName, projectTypeLabel string) Template {
	return Template{
		Subject: fmt.Sprintf("Project completed — %s", vesselName),
		Body: fmt.Sprintf(`Hello,

The %s project on %s has been marked complete. All documents remain available in AuditVault for your records.

Thank you,
— Nivyash Maritime Consultancy
`, projectTypeLabel, vesselName),
	}
}

// FinalReportUploaded — sent to client users when a new FINAL_REPORT file is
// uploaded against a project.
func FinalReportUploaded(vesselName, projectTypeLabel, fileName string) Template {
	return Template{
		Subject: fmt.Sprintf("Final report uploaded — %s", vesselName),
		Body: fmt.Sprintf(`Hello,

A final report has been uploaded for %s (%s).

File: %s

Sign in to AuditVault to download.

— Nivyash Maritime Consultancy
`, vesselName, projectTypeLabel, fileName),
	}
}

// FeedbackReceived — sent to Nivyash admin/staff when a client uploads a
// FEEDBACK file.
func FeedbackReceived(vesselName, projectTypeLabel, fileName, clientName string) Template {
	return Template{
		Subject: fmt.Sprintf("Feedback received from %s — %s", clientName, vesselName),
		Body: fmt.Sprintf(`%s has uploaded feedback on the %s project for %s.

File: %s

Sign in to AuditVault to review and respond.
`, clientName, projectTypeLabel, vesselName, fileName),
	}
}
