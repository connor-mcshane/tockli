import type { Metadata } from "next";
import Link from "next/link";
import MarketingFooter from "@/app/MarketingFooter";
import MarketingHeader from "@/app/MarketingHeader";

const lastUpdated = "2026-08-07";
const contactEmail = "hello@tockli.com";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms that apply when you create an account or use Tockli's task board, focus timer, sharing, and analytics features.",
  alternates: {
    canonical: "/terms",
  },
  openGraph: {
    title: "Tockli Terms of Service",
    description:
      "The terms that apply when you create an account or use Tockli.",
    images: ["/og.png"],
    url: "/terms",
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

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#1a1c1b]">
      <MarketingHeader />

      <section className="border-b border-[#e8e8e6] bg-white px-4 py-14 md:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold uppercase text-[#b90042]">Legal</p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
            Terms of Service
          </h1>
          <p className="mt-5 text-lg leading-8 text-[#62605b]">
            These terms cover your use of the Tockli website and app. By creating
            an account or using Tockli, you agree to them.
          </p>
          <p className="mt-5 text-sm font-semibold text-[#6a6965]">
            Last updated <time dateTime={lastUpdated}>7 August 2026</time>
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl space-y-10 px-4 py-12 md:px-8">
        <Section heading="Using Tockli">
          <p>
            You must be at least 13 years old and legally able to agree to these
            terms. If you use Tockli for an organisation, you confirm that you
            have authority to accept these terms for it.
          </p>
          <p>
            Keep your sign-in details secure and tell us promptly if you think
            someone else has accessed your account. You are responsible for the
            activity carried out through your account unless it resulted from a
            failure on our side.
          </p>
        </Section>

        <Section heading="Your work stays yours">
          <p>
            You keep ownership of task titles, notes, comments, session notes,
            and other content you add. You give Tockli permission to store,
            process, display, and transmit that content only as needed to run,
            secure, and improve the service and to provide features you choose,
            such as sharing a project.
          </p>
          <p>
            You are responsible for having the right to add and share your
            content. Do not add unlawful material, confidential information you
            are not authorised to use, malware, or content that infringes
            another person&apos;s rights.
          </p>
        </Section>

        <Section heading="Shared projects">
          <p>
            When you invite someone to a project, that person may be able to
            view or edit its content according to the role you assign. Check the
            address and access level before sending an invitation. Project owners
            are responsible for managing member access.
          </p>
        </Section>

        <Section heading="Fair use">
          <p>You must not:</p>
          <ul className="list-disc space-y-3 pl-6">
            <li>break the law or another person&apos;s rights using Tockli;</li>
            <li>
              probe, disrupt, overload, scrape, or bypass the security or usage
              limits of the service;
            </li>
            <li>
              upload malicious code or try to access accounts or data that are
              not yours; or
            </li>
            <li>
              resell or misrepresent the service without written permission.
            </li>
          </ul>
          <p>
            We may restrict or suspend access where reasonably necessary to stop
            misuse, protect other users, comply with law, or maintain the
            service. Where practical, we will explain what happened and give you
            a chance to resolve it.
          </p>
        </Section>

        <Section heading="Plans and payments">
          <p>
            Tockli currently offers a free plan. Features described as coming
            soon are not part of the service until they are released. If paid
            plans are introduced, their price, billing period, renewal terms,
            cancellation process, and any applicable refund rights will be shown
            before you buy. We will update these terms before taking payment.
          </p>
        </Section>

        <Section heading="The Tockli service">
          <p>
            Tockli and its design, software, branding, and documentation belong
            to its operator or licensors. These terms give you a limited,
            revocable, non-transferable right to use the service; they do not
            transfer ownership of Tockli to you.
          </p>
          <p>
            We work to keep Tockli reliable, but an online service can sometimes
            be interrupted or contain errors. Features may change as the product
            develops. We do not promise uninterrupted availability, permanent
            storage, or that Tockli will meet every particular requirement. Keep
            a separate copy of anything you cannot afford to lose.
          </p>
        </Section>

        <Section heading="Closing an account">
          <p>
            You may stop using Tockli at any time. To request account closure and
            deletion, email{" "}
            <a
              className="font-semibold text-[#ff005e] transition hover:text-[#e00054]"
              href={`mailto:${contactEmail}`}
            >
              {contactEmail}
            </a>{" "}
            from the address on your account. Our{" "}
            <Link
              className="font-semibold text-[#ff005e] transition hover:text-[#e00054]"
              href="/privacy"
            >
              privacy policy
            </Link>{" "}
            explains what happens to account data.
          </p>
        </Section>

        <Section heading="Liability">
          <p>
            Nothing in these terms excludes liability that cannot lawfully be
            excluded, including liability for fraud, fraudulent
            misrepresentation, or death or personal injury caused by negligence.
            Subject to that, Tockli is provided on an “as available” basis and
            is not responsible for indirect or unforeseeable loss, lost profits,
            lost business, or loss caused by events outside reasonable control.
          </p>
          <p>
            If you use Tockli as a consumer, your statutory rights are not
            affected. Tockli is a productivity tool, not professional medical,
            employment, financial, or legal advice.
          </p>
        </Section>

        <Section heading="Changes and governing law">
          <p>
            We may update these terms as the product or the law changes. Material
            changes will be dated here and, where appropriate, explained in the
            app or by email before they take effect. If you do not agree with an
            update, you may stop using Tockli and close your account.
          </p>
          <p>
            These terms are governed by the laws of England and Wales. If you
            are a consumer, you keep any mandatory protections and rights to
            bring a claim in the courts available to you under the law where you
            live.
          </p>
        </Section>

        <Section heading="Contact">
          <p>
            Questions about these terms can be sent to{" "}
            <a
              className="font-semibold text-[#ff005e] transition hover:text-[#e00054]"
              href={`mailto:${contactEmail}`}
            >
              {contactEmail}
            </a>
            .
          </p>
        </Section>
      </div>

      <MarketingFooter />
    </main>
  );
}
