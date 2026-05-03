package email

import (
	"context"
	"log/slog"

	"github.com/resend/resend-go/v2"
)

// Mailer abstracts the email backend so tests / dev can run without a real
// Resend account. The Resend implementation is below; a NoopMailer is used
// when RESEND_API_KEY is empty.
type Mailer interface {
	Send(ctx context.Context, to []string, subject, body string) error
}

type resendMailer struct {
	client *resend.Client
	from   string
}

func NewResend(apiKey, from string) Mailer {
	if apiKey == "" {
		return NoopMailer{}
	}
	return &resendMailer{client: resend.NewClient(apiKey), from: from}
}

func (m *resendMailer) Send(ctx context.Context, to []string, subject, body string) error {
	if len(to) == 0 {
		return nil
	}
	_, err := m.client.Emails.SendWithContext(ctx, &resend.SendEmailRequest{
		From:    m.from,
		To:      to,
		Subject: subject,
		Text:    body,
	})
	return err
}

type NoopMailer struct{}

func (NoopMailer) Send(_ context.Context, to []string, subject, body string) error {
	slog.Info("email.noop", "to", to, "subject", subject, "body_len", len(body))
	return nil
}
