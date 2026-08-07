import type { Metadata } from "next";
import Link from "next/link";
import MarketingFooter from "@/app/MarketingFooter";
import MarketingHeader from "@/app/MarketingHeader";

const lastUpdated = "2026-08-07";
const contactEmail = "hello@tockli.com";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Tockli collects, stores, and deletes your account data, task boards, focus sessions, and session notes.",
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: "Tockli Privacy Policy",
    description:
      "What Tockli stores, where it is stored, how long it is kept, and how to ask for it to be deleted.",
    images: ["/og.png"],
    url: "/privacy",
  },
};

function Section({
  children,
  heading,
}: {
  children: React.ReactNode;
  heading: string;
}) {
  return (
    <section>
      <h2 className="text-2xl font-semibold">{heading}</h2>
      <div className="mt-4 space-y-4 text-base leading-8 text-[#4f4d49]">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#1a1c1b]">
      <MarketingHeader />

      <section className="border-b border-[#e8e8e6] bg-white px-4 py-14 md:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold uppercase text-[#b90042]">Legal</p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-5 text-lg leading-8 text-[#62605b]">
            Tockli is a task board with a focus timer built in. This policy
            explains exactly what the product stores, why it stores it, and how
            to get it back or get rid of it.
          </p>
          <p className="mt-5 text-sm font-semibold text-[#6a6965]">
            Last updated{" "}
            <time dateTime={lastUpdated}>7 August 2026</time>
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl space-y-10 px-4 py-12 md:px-8">
        <p className="rounded-lg border border-[#ffd0de] bg-[#fff4f7] p-5 text-base leading-7 text-[#4f4d49]">
          <strong className="font-semibold text-[#1a1c1b]">
            A note on what is coming.
          </strong>{" "}
          Tockli does not yet run a product analytics service. Analytics is
          planned, and this policy will be updated with the provider, the events
          collected, and the retention period before any of it goes live.
        </p>

        <Section heading="Who is responsible for your data">
          <p>
            Tockli is an independent product built and operated from the United
            Kingdom. For the purposes of UK GDPR, Tockli is the data controller
            for the information described below. You can reach the operator at{" "}
            <a
              className="font-semibold text-[#ff005e] transition hover:text-[#e00054]"
              href={`mailto:${contactEmail}`}
            >
              {contactEmail}
            </a>
            .
          </p>
        </Section>

        <Section heading="Signing in">
          <p>
            Authentication is handled by Supabase Auth. You can create an
            account with an email address and password, or sign in with Google.
            Tockli never sees or stores your password: Supabase stores a hash of
            it, and Google sign-in never sends a password to us at all.
          </p>
          <p>
            If you sign in with Google, Google shares your email address, name,
            and profile picture URL with Tockli so an account can be created.
            Nothing else is requested from your Google account, and Tockli does
            not read your Google Calendar, Drive, or contacts.
          </p>
        </Section>

        <Section heading="What Tockli stores, and why">
          <p>
            Everything below lives in the product database so your board and
            your history are there when you sign back in.
          </p>
          <ul className="list-disc space-y-3 pl-6">
            <li>
              <strong className="font-semibold text-[#1a1c1b]">
                Your profile.
              </strong>{" "}
              Email address, display name, avatar URL, and which plan you are on.
              Used to identify your account and show you as the owner of your
              work.
            </li>
            <li>
              <strong className="font-semibold text-[#1a1c1b]">
                Projects and boards.
              </strong>{" "}
              Project names, descriptions, colours, and your board columns.
            </li>
            <li>
              <strong className="font-semibold text-[#1a1c1b]">
                Sharing.
              </strong>{" "}
              If you invite someone to a project, Tockli stores the email address
              you invited, the role you gave them, an invitation token, and
              whether the invitation is pending, accepted, or revoked.
              Invitations expire after 14 days.
            </li>
            <li>
              <strong className="font-semibold text-[#1a1c1b]">
                Tasks and their detail.
              </strong>{" "}
              Task titles, notes, status, priority, time estimates, time spent,
              due labels, plus your categories, tags, subtasks, and comments.
            </li>
            <li>
              <strong className="font-semibold text-[#1a1c1b]">
                Focus sessions.
              </strong>{" "}
              When you finish a session, Tockli records the length in minutes,
              the project and task it belonged to, when it finished, and the
              session note you wrote.
            </li>
            <li>
              <strong className="font-semibold text-[#1a1c1b]">
                Cancelled sessions.
              </strong>{" "}
              If you stop a timer early, Tockli records the planned length, how
              long you actually ran, a reason chosen from a fixed list
              (interrupted, wrong task, needed a break, or other), and an
              optional note. This is what makes the focus score and the
              interruption patterns meaningful.
            </li>
            <li>
              <strong className="font-semibold text-[#1a1c1b]">
                Settings.
              </strong>{" "}
              Focus and break lengths, your daily session goal, working days,
              strict mode, sound choice and volume, and light or dark theme.
            </li>
            <li>
              <strong className="font-semibold text-[#1a1c1b]">
                Marketing signups.
              </strong>{" "}
              If you sign up from the landing page, Tockli stores the email
              address you gave, the role and intent you selected, where you
              arrived from, and which landing-page variant you saw.
            </li>
          </ul>
        </Section>

        <Section heading="Session notes and task notes are free text">
          <p>
            Session notes, task notes, comments, and cancellation notes are
            written by you and stored as you typed them. Tockli does not parse
            them, scan them, or use them to build a profile of you. Because they
            are free text, please do not put passwords, financial details,
            health information, or anything else sensitive into them.
          </p>
        </Section>

        <Section heading="Where your data is stored">
          <p>
            Tockli uses Supabase for authentication and database storage. Your
            data sits in a Postgres database protected by
            row-level security policies, so a signed-in account can only read
            and write its own rows and the rows of projects it has been given
            access to.
          </p>
          <p>
            The website and application are hosted on Netlify. Netlify processes
            standard server request data such as IP address and user agent in
            order to serve pages and protect against abuse.
          </p>
          <p>
            Supabase, Netlify, and Google (only if you use Google sign-in) act
            as processors for Tockli. Data may be processed outside the UK by
            these providers under the appropriate transfer safeguards in their
            data processing terms.
          </p>
        </Section>

        <Section heading="Cookies and local storage">
          <p>
            Tockli does not use advertising cookies and does not sell data to
            anyone.
          </p>
          <ul className="list-disc space-y-3 pl-6">
            <li>
              <strong className="font-semibold text-[#1a1c1b]">
                Supabase authentication.
              </strong>{" "}
              Signing in stores a session token in your browser so you stay
              signed in. Signing out clears it. This is strictly necessary for
              the product to work.
            </li>
            <li>
              <strong className="font-semibold text-[#1a1c1b]">
                <code className="font-mono text-sm">
                  tockli.analytics.anonymousId
                </code>
                .
              </strong>{" "}
              A random identifier held in your browser&apos;s local storage so
              that product events can be counted without being tied to your
              name. It is not linked to your account record.
            </li>
            <li>
              <strong className="font-semibold text-[#1a1c1b]">
                <code className="font-mono text-sm">tockli.experiments</code>.
              </strong>{" "}
              Which landing-page variant you were assigned, held in local
              storage so the page does not change under you between visits.
            </li>
          </ul>
          <p>
            Earlier builds used the keys{" "}
            <code className="font-mono text-sm">
              flowtimer.analytics.anonymousId
            </code>{" "}
            and <code className="font-mono text-sm">flowtimer.experiments</code>
            . These are migrated to the current keys and removed the next time
            you load the site.
          </p>
          <p>
            Clearing your browser storage removes all of the above. You will be
            signed out and given a new anonymous identifier.
          </p>
        </Section>

        <Section heading="Product analytics">
          <p>
            Today, product events are recorded in the page you are looking at and
            are not sent anywhere unless an analytics endpoint has been
            configured for the deployment. When a hosted analytics provider is
            added, this policy will be updated first to name the provider, the
            events collected, and how long they are kept.
          </p>
        </Section>

        <Section heading="Our legal bases">
          <p>
            Tockli relies on <strong>performance of a contract</strong> to run
            your account, store your boards, and keep your focus history. It
            relies on <strong>legitimate interests</strong> to keep the service
            secure, to prevent abuse, and to understand in aggregate which parts
            of the product are used. Where consent is required, for example for
            non-essential analytics, it will be asked for before the processing
            starts.
          </p>
        </Section>

        <Section heading="How long data is kept">
          <p>
            Your account data, boards, tasks, and focus history are kept for as
            long as your account exists, because the point of the focus history
            is that it accumulates.
          </p>
          <p>
            Deleting a task or project also removes records attached to it where
            the database relationship is configured to cascade. Pending
            invitations expire after 14 days. To close your account and request
            deletion of the remaining account data, use the contact address
            below. Backup copies may remain for a limited period until the
            provider&apos;s normal backup cycle rolls over, or where retention is
            required by law.
          </p>
        </Section>

        <Section heading="Your rights">
          <p>
            Under UK GDPR you have the right to access your data, to correct it,
            to have it erased, to receive a portable copy, to restrict or object
            to processing, and to withdraw any consent you have given. You can do
            a lot of this yourself from within the app by editing or deleting
            your content.
          </p>
          <p>
            For anything else, including a full export or a full deletion, email{" "}
            <a
              className="font-semibold text-[#ff005e] transition hover:text-[#e00054]"
              href={`mailto:${contactEmail}`}
            >
              {contactEmail}
            </a>{" "}
            from the address on your account. Requests are answered within 30
            days.
          </p>
          <p>
            If you are not happy with how a request was handled, you can complain
            to the Information Commissioner&apos;s Office, the UK supervisory
            authority, at{" "}
            <a
              className="font-semibold text-[#ff005e] transition hover:text-[#e00054]"
              href="https://ico.org.uk/make-a-complaint/"
            >
              ico.org.uk
            </a>
            .
          </p>
        </Section>

        <Section heading="Children">
          <p>
            Tockli is not intended for children under 13, and accounts should not
            be created for them.
          </p>
        </Section>

        <Section heading="Changes to this policy">
          <p>
            When this policy changes in a way that affects what is collected or
            who it is shared with, the date at the top will be updated and the
            change will be noted on the{" "}
            <Link
              className="font-semibold text-[#ff005e] transition hover:text-[#e00054]"
              href="/blog"
            >
              blog
            </Link>
            . Continuing to use Tockli after an update means the updated policy
            applies. The{" "}
            <Link
              className="font-semibold text-[#ff005e] transition hover:text-[#e00054]"
              href="/terms"
            >
              terms of service
            </Link>{" "}
            cover the rest of the relationship.
          </p>
        </Section>
      </div>

      <MarketingFooter />
    </main>
  );
}
