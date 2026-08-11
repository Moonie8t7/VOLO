/**
 * Everything VOLO does with a visitor's data, named specifically.
 *
 * The tool asks people to hand over a file that lists what they have installed
 * and then tells them it stays in the browser. That claim was only ever made in
 * one FAQ answer someone had to open, and it was not the whole story: an order
 * that gets submitted becomes public, the host keeps request logs, and the page
 * loads a typeface from Google. A page that states the awkward parts is worth
 * more than one that repeats the reassuring part twice.
 *
 * Written from what the code does, so anything that changes here has to change
 * with it: the browser-side scrub is lib/scrub.ts, the storage keys are in
 * lib/store.tsx, and the submission path is functions/api/submit.js.
 */

import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

const REPO = 'https://github.com/Moonie8t7/VOLO';

export default function PrivacyPage() {
  return (
    <div className="p-8 overflow-auto min-h-screen bg-gradient-to-br from-background via-background to-card">
      <div className="max-w-3xl mx-auto space-y-10">
        <header>
          <h1 className="text-4xl font-display font-bold text-gradient-bg3">
            Privacy
          </h1>
          <p className="text-muted-foreground mt-2 font-body">
            What VOLO does with your file, and everything it sends anywhere.
          </p>
        </header>

        <section className="space-y-4 font-body leading-relaxed">
          <h2 className="font-display text-2xl font-bold">The short version</h2>
          <p>
            There is no account, no advertising, no tracking cookie and nothing
            sold to anybody. Your load order is read inside your browser and is
            never uploaded, unless you decide to submit it, which is a separate
            button that says so. Everything below is the detail behind that.
          </p>
        </section>

        <section className="space-y-4 font-body leading-relaxed">
          <h2 className="font-display text-2xl font-bold">Sorting your order</h2>
          <p>
            The file you drop in is parsed by code running on your own machine.
            It is the masterlist that travels, downloaded to you, and the sort
            happens against it locally. No copy of your order is sent to a
            server, written to a log or seen by anyone. If you would rather
            check than take my word for it, open your browser's network tab
            while you import: there is no upload to see.
          </p>
        </section>

        <section className="space-y-4 font-body leading-relaxed">
          <h2 className="font-display text-2xl font-bold">
            What is kept on your device
          </h2>
          <p>
            Nothing, until you turn on remembering. Do that and two values go
            into your browser's local storage: the fact that you asked, and the
            imported order along with any slots you assigned by hand, so a
            reload does not lose your work. Both stay on your device, both are
            deleted the moment you turn remembering off, and clearing site data
            removes them. VOLO sets no cookies at all.
          </p>
        </section>

        <section className="space-y-4 font-body leading-relaxed">
          <h2 className="font-display text-2xl font-bold">
            If you submit an order
          </h2>
          <p>
            Submitting is the one action that publishes something. The order
            becomes a public issue on the repository and then a file in a public
            corpus, released under CC0, because the whole tool is built by
            counting what is in those files and nobody can check the counting
            without the files. No name, no email and no account go with it.
          </p>
          <p>
            Before it leaves your browser, filesystem paths are stripped out.
            BG3 Mod Manager writes the full path of a pak into some entries, and
            that path contains the account name of whoever exported it, so one
            submitted order can publish a stranger's real name without them ever
            deciding to. It happened once, which is why the same scrub now runs
            three times: in your browser, again at the API, and again when the
            order is taken into the corpus.
          </p>
          <p>
            An order too large to fit in an issue is stored first in Cloudflare
            R2, and the issue carries a link to it with an entry count and a
            checksum. That copy holds the same scrubbed text that would have
            gone into the issue.
          </p>
        </section>

        <section className="space-y-4 font-body leading-relaxed">
          <h2 className="font-display text-2xl font-bold">
            Other services your browser talks to
          </h2>
          <p>
            <strong>Cloudflare</strong> hosts the site, so every request reaches
            them and their logs record it in the ordinary way any web host does,
            IP address included. The submit page also loads Cloudflare Turnstile,
            which is the check that you are not a bot, and your IP is passed to
            it as part of that check.
          </p>
          <p>
            <strong>Nobody else.</strong> The typeface used to come from Google
            Fonts, which meant Google received a request from your browser on
            every page you opened here. It is served from this site now, so it
            does not. There is no content delivery network in front of the code,
            no embedded video, no comment widget and no advertising.
          </p>
          <p>
            <strong>GitHub</strong> is contacted only as a fallback, if the
            masterlist fails to download from this site.{' '}
            <strong>Ko-fi, Patreon and PayPal</strong> are contacted only if you
            click one of those links: the support page uses plain links rather
            than embedded widgets, precisely so that nothing loads from them
            unless you choose to go there.
          </p>
        </section>

        <section className="space-y-4 font-body leading-relaxed">
          <h2 className="font-display text-2xl font-bold">Measurement</h2>
          <p>
            There is no Google Analytics here, no advertising pixel, no
            cross-site tracker and no fingerprinting. The only figures I see are
            Cloudflare's, as the host: aggregate counts of pages requested, with
            no cookie set and no profile of you built. Search Console shows me
            which searches the site appears in, which is about queries rather
            than people.
          </p>
        </section>

        <section className="space-y-4 font-body leading-relaxed">
          <h2 className="font-display text-2xl font-bold">
            Changing your mind
          </h2>
          <p>
            If you have submitted an order and want it gone, ask and it will be
            taken out of the corpus and the masterlist rebuilt without it. Be
            aware of what that can and cannot undo: the file is removed from the
            project going forward, but it was public, and old commits keep their
            contents unless the history is rewritten. If something personal
            reached the corpus, say so plainly in the request and I will treat
            it as a history rewrite rather than a deletion.
          </p>
        </section>

        <section className="space-y-4 font-body leading-relaxed">
          <h2 className="font-display text-2xl font-bold">Asking about any of it</h2>
          <p>
            Questions and removal requests go to{' '}
            <a
              href={`${REPO}/issues`}
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground"
            >
              the issue tracker
            </a>
            . This page carries no revision date on purpose, since a date is
            easy to leave stale: every change to it is a commit, and{' '}
            <a
              href={`${REPO}/commits/main/client/src/pages/PrivacyPage.tsx`}
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground"
            >
              the history is public
            </a>
            , so you can read what changed and when rather than trust a line at
            the bottom.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/about">
              <Button variant="outline">About VOLO</Button>
            </Link>
            <a href={REPO} target="_blank" rel="noreferrer">
              <Button variant="outline">View the source</Button>
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
