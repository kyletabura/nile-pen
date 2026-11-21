import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LogIn, ShieldCheck, LayoutDashboard, PenLine, Image as ImageIcon, Radio, Inbox, Mail, Users, Tags, UserCog,
  Settings as Cog, UploadCloud, LifeBuoy, ArrowRight,
} from 'lucide-react';
import { markGuideStep } from '../components/GettingStarted.jsx';

/*
  The newsroom guide. Written for someone opening the dashboard for the first time:
  short numbered steps, the dashboard's own button names in bold, one screenshot per area.
*/
const SECTIONS = [
  { id: 'sign-in', icon: LogIn, title: 'Signing in for the first time' },
  { id: 'two-step', icon: ShieldCheck, title: 'Protect your account' },
  { id: 'overview', icon: LayoutDashboard, title: 'Find your way around' },
  { id: 'write', icon: PenLine, title: 'Write and publish a story' },
  { id: 'photos', icon: ImageIcon, title: 'Add and edit photos' },
  { id: 'live', icon: Radio, title: 'Post a Live update' },
  { id: 'publish', icon: UploadCloud, title: 'How publishing works' },
  { id: 'pitches', icon: Inbox, title: 'Review pitches from writers' },
  { id: 'messages', icon: Mail, title: 'Answer messages' },
  { id: 'subscribers', icon: Users, title: 'Newsletter subscribers' },
  { id: 'topics', icon: Tags, title: 'Change the site menu (topics)' },
  { id: 'team', icon: UserCog, title: 'Add people to the team' },
  { id: 'settings', icon: Cog, title: 'Site settings and your account' },
  { id: 'help', icon: LifeBuoy, title: 'Something went wrong?' },
];

function Shot({ src, alt, caption }) {
  return (
    <figure className="guide-shot">
      <img src={src} alt={alt} loading="lazy" />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

function Section({ id, icon: Icon, title, children }) {
  return (
    <section id={id} className="guide-section">
      <h2 className="guide-h2"><span className="guide-ic"><Icon /></span>{title}</h2>
      {children}
    </section>
  );
}

export default function Guide() {
  const [active, setActive] = useState(SECTIONS[0].id);
  useEffect(() => { markGuideStep('guide'); }, []);
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean);
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) setActive(vis.target.id);
    }, { rootMargin: '-80px 0px -65% 0px' });
    els.forEach((el) => io.observe(el));
    if (window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Newsroom guide</h1>
          <p>Everything you need to run The Nile Pen from this dashboard, step by step. Takes about ten minutes to read.</p>
        </div>
      </div>

      <div className="guide">
        <nav className="guide-toc card" aria-label="Guide sections">
          {SECTIONS.map((s, i) => (
            <a key={s.id} href={'#' + s.id} className={active === s.id ? 'on' : ''}
              onClick={(e) => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' }); history.replaceState(null, '', '#' + s.id); }}>
              <span className="n">{i + 1}</span>{s.title}
            </a>
          ))}
        </nav>

        <article className="guide-body card">
          <Section {...SECTIONS[0]}>
            <p>The newsroom lives at <b>app.thenilepen.com</b>. Only people the site owner adds can sign in; there is no public sign-up.</p>
            <ol>
              <li>Open <b>app.thenilepen.com</b> and enter the email and the <b>temporary password</b> the owner sent you.</li>
              <li>You'll see <b>Set your own password</b>. Type a new password twice. It needs at least 12 characters, a mix of letters, numbers or symbols, and no common words. Each rule ticks green when it's met.</li>
              <li>Press <b>Save and continue</b>. You're in. The temporary password stops working.</li>
            </ol>
            <Shot src="/guide/sign-in.jpg" alt="The sign-in page" caption="The sign-in page. Forgot your password? Use the link above the password box." />
            <Shot src="/guide/set-password.jpg" alt="The Set your own password screen with strength rules" caption="First sign-in: choose your own password. The rules turn green as you type." />
            <p className="guide-tip"><b>Forgot your password later?</b> Click <b>Forgot password?</b> on the sign-in page and enter your email. A link to choose a new one arrives within a few minutes (check spam). Or ask the owner to give you a new temporary password from <b>Team</b>.</p>
          </Section>

          <Section {...SECTIONS[1]}>
            <p>Two-step verification means signing in needs your password <i>and</i> a 6-digit code from your phone. A stolen password alone then gets nobody in. Please turn it on.</p>
            <ol>
              <li>Install <b>Google Authenticator</b> or <b>Microsoft Authenticator</b> on your phone (free).</li>
              <li>In the dashboard go to <b>Settings</b> → <b>Two-step verification</b> → <b>Set up two-step verification</b>.</li>
              <li>In the app, tap <b>+</b> / <b>Add account</b> and scan the QR code on screen.</li>
              <li>Type the 6-digit code the app shows and press <b>Turn on</b>.</li>
            </ol>
            <p>From now on, after your password you'll be asked for the current code. Codes change every 30 seconds.</p>
            <Shot src="/guide/two-step.jpg" alt="Settings page with the two-step verification card" caption="Settings → Two-step verification." />
            <p className="guide-tip"><b>New phone or lost phone?</b> Ask the owner to press <b>Reset two-step</b> next to your name on <b>Team</b>, then set it up again on the new phone.</p>
            <p className="guide-tip"><b>Automatic sign-out:</b> after an hour without activity the dashboard signs you out to keep it safe. Your saved work is never lost; just sign in again.</p>
          </Section>

          <Section {...SECTIONS[2]}>
            <p>The menu on the left takes you everywhere. On a phone, tap <b>☰</b> at the top left to open it.</p>
            <ul>
              <li><b>Overview</b>: what needs you today (new pitches, messages, unfinished drafts) and the main numbers.</li>
              <li><b>Stories</b> and <b>Live updates</b>: everything published or in draft.</li>
              <li><b>Pitches</b>, <b>Messages</b>, <b>Subscribers</b>: what readers and writers sent through the site. Red numbers show what's new.</li>
              <li><b>Media library</b>, <b>Topics</b>, <b>Team</b>, <b>Settings</b>: the site itself.</li>
              <li><b>Search</b> at the top finds any story by title or author. Shortcut: <b>Ctrl K</b>.</li>
            </ul>
            <Shot src="/guide/overview.jpg" alt="The Overview page with counts and the Needs your attention list" caption="Overview: start here every day." />
          </Section>

          <Section {...SECTIONS[3]}>
            <ol>
              <li>Press <b>Write a story</b> (Overview) or <b>New story</b> (top bar).</li>
              <li>Click the <b>topics</b> the story belongs to. The first one you pick (red) is the main section.</li>
              <li>Type the <b>Headline</b>, then the <b>Standfirst</b>: one or two sentences under the headline that make people want to read on. It's also what Google and WhatsApp show.</li>
              <li>Write or paste the story. <b>Leave an empty line between paragraphs.</b></li>
              <li>On the right: add a <b>Main image</b> (see the next section), check the <b>Byline</b> and <b>Publication date</b>. Switch on <b>Feature on the homepage</b> to put it in the big rotating picture at the top of the site.</li>
              <li>Press <b>Preview</b> to see roughly how it will look.</li>
              <li>Press <b>Save draft</b> to keep working later, or <b>Publish</b> when it's ready. It appears on thenilepen.com about a minute later.</li>
            </ol>
            <Shot src="/guide/editor.jpg" alt="The story editor" caption="The story editor: write on the left, settings on the right." />
            <p><b>Fixing a published story:</b> open it from <b>Stories</b>, make the change and press <b>Update live story</b>.</p>
            <p><b>Taking a story down:</b> <b>Unpublish</b> turns it back into a draft. <b>Archive</b> hides it but keeps a copy. <b>Delete permanently</b> removes it for good.</p>
            <p className="guide-tip"><b>Ctrl S</b> saves at any time. If you try to leave with unsaved changes, the dashboard asks first. The <b>Search and sharing</b> box shows exactly how the story will look in Google.</p>
          </Section>

          <Section {...SECTIONS[4]}>
            <ol>
              <li>In the story editor, click <b>Add a photo</b> in the <b>Main image</b> box. Or open <b>Media library</b> and press <b>Upload photos</b>.</li>
              <li>Drag a photo in, or press <b>Upload from your device</b>.</li>
              <li>The image editor opens. Choose a <b>Shape</b> (Wide 16:9 is best for story headers), <b>Rotate</b> if needed, use <b>Zoom</b> and the <b>Move</b> sliders to frame it, then <b>Save image</b>.</li>
              <li>Back in the story, fill in <b>Photo credit</b> and <b>Photo source</b>. They appear under the story.</li>
            </ol>
            <Shot src="/guide/media.jpg" alt="The image editor with crop, rotate and zoom controls" caption="Every photo is cropped and compressed so pages load fast on phones." />
            <p className="guide-tip">Photos already in the library can be reused: click <b>Add a photo</b> and pick one. To change one, open it in <b>Media library</b> and choose <b>Edit a copy</b>. Only use photos you have the right to publish, and always credit the photographer.</p>
          </Section>

          <Section {...SECTIONS[5]}>
            <p>Live updates are short summaries of news reported by another outlet, with a link to the original. They fill the <b>Live</b> page and the scrolling ticker.</p>
            <ol>
              <li>Press <b>Post a Live update</b> (Overview) or go to <b>Live updates</b> → <b>New Live update</b>.</li>
              <li>Pick the topic, write a clear <b>headline</b> and a one or two sentence <b>summary</b> in your own words.</li>
              <li>Under <b>Original reporting</b>, enter the <b>Outlet</b> (e.g. Radio Tamazuj) and the <b>Link to the original</b>.</li>
              <li>Press <b>Publish</b>.</li>
            </ol>
            <p>Readers see "This is a Nile Pen summary of reporting by …" with a button to the original. A photo is optional; without one the site shows a branded card.</p>
          </Section>

          <Section {...SECTIONS[6]}>
            <p>Every time you publish, update or remove a story, the dashboard rebuilds thenilepen.com for you. The change is live in about a minute.</p>
            <p>Changes to <b>Topics</b> and <b>Settings</b> publish the same way. If the button at the top right turns red and says <b>Publish changes</b>, something is saved but not live yet: press it.</p>
            <p className="guide-tip">Don't see your change? Wait a minute, then refresh the site page (pull down on a phone).</p>
          </Section>

          <Section {...SECTIONS[7]}>
            <p>Writers send pitches from the <b>Write for The Nile Pen</b> page. They land in <b>Pitches</b> → <b>To review</b>.</p>
            <ol>
              <li>Click a pitch to read it, with the writer's name, email and location.</li>
              <li><b>Approve</b>: choose <b>Approve and start a draft story</b> to turn it straight into a draft you can edit, or approve only.</li>
              <li><b>Decline</b>: pick a reason, add a note if you like, and tick <b>Open an email to let the writer know</b> to send a polite reply.</li>
              <li>Use <b>Reply by email</b> to talk to the writer from your own email.</li>
            </ol>
            <Shot src="/guide/pitches.jpg" alt="The Pitches page with a pitch open and Approve and Decline buttons" caption="Pitches: list on the left, the full pitch on the right." />
            <p className="guide-tip">Writers aren't emailed automatically. Always reply, even with a no: it keeps good writers coming back.</p>
          </Section>

          <Section {...SECTIONS[8]}>
            <p>Messages from the <b>Contact</b> and <b>Advertise</b> pages arrive in <b>Messages</b>. Opening one marks it read.</p>
            <ul>
              <li><b>Reply</b> opens your email app with the message quoted.</li>
              <li><b>Archive</b> tidies it away; <b>Delete</b> removes it for good.</li>
              <li>Filter by subject (e.g. <b>Advertising</b> or <b>Corrections</b>) at the top of the list.</li>
            </ul>
          </Section>

          <Section {...SECTIONS[9]}>
            <p>Everyone who signs up on the site appears in <b>Subscribers</b>.</p>
            <ul>
              <li><b>Copy emails</b> copies every active address. Paste them into the <b>BCC</b> box of an email to send the newsletter (BCC keeps addresses private).</li>
              <li><b>Export CSV</b> downloads the list for a newsletter service later.</li>
              <li><b>Unsubscribe</b> when someone asks to stop. <b>Delete</b> only if they ask for their data to be erased.</li>
            </ul>
          </Section>

          <Section {...SECTIONS[10]}>
            <p>Topics are the sections in the site menu (South Sudan, Human Rights, …).</p>
            <ul>
              <li>Edit a <b>Section name</b>, the short <b>Menu label</b> or the <b>Description</b>, then press <b>Save changes</b>.</li>
              <li>Use the arrows to change the order in the menu.</li>
              <li><b>Add topic</b> creates a new section. A topic can only be deleted once no published story uses it.</li>
            </ul>
          </Section>

          <Section {...SECTIONS[11]}>
            <p>Only <b>owners</b> can manage the team.</p>
            <ol>
              <li>Go to <b>Team</b> → <b>Add a person</b>. Enter their name and email and choose <b>Editor</b> (write, publish, review) or <b>Owner</b> (everything, plus the team).</li>
              <li>Press <b>Create account</b>, then <b>Copy sign-in details</b> and send them privately, for example on WhatsApp.</li>
              <li>They choose their own password the first time they sign in.</li>
            </ol>
            <p>Next to each person: <b>Reset password</b> (gives a new temporary password), <b>Reset two-step</b> (lost phone) and the bin icon to remove them.</p>
            <Shot src="/guide/team.jpg" alt="The Team page" caption="Team: who can sign in, and what they can do." />
          </Section>

          <Section {...SECTIONS[12]}>
            <ul>
              <li><b>Show the news ticker</b>: turns the scrolling "Latest news" bar on or off.</li>
              <li><b>Social links in the footer</b>: paste The Nile Pen's Instagram, X, Facebook, LinkedIn and WhatsApp links. Empty boxes are hidden on the site.</li>
              <li><b>Your profile</b>, <b>Change password</b> and <b>Two-step verification</b>: your own account.</li>
              <li><b>Sign out everywhere</b>: use it if you signed in on a shared or lost device.</li>
              <li><b>Sign-in activity</b> (owners): recent sign-ins. Anything you don't recognise? Reset that person's password.</li>
            </ul>
          </Section>

          <Section {...SECTIONS[13]}>
            <dl className="guide-faq">
              <dt>"Too many wrong attempts"</dt><dd>Sign-in pauses for a while after five wrong passwords. Wait, or use <b>Forgot password?</b>.</dd>
              <dt>The reset email didn't arrive</dt><dd>Check spam and wait a few minutes. Still nothing? Ask the owner for a temporary password from <b>Team</b>.</dd>
              <dt>My change isn't on the site</dt><dd>Wait a minute and refresh. If the top-right button says <b>Publish changes</b>, press it.</dd>
              <dt>A photo won't upload</dt><dd>Use JPG, PNG or WebP under 25 MB. Phone photos are fine; the dashboard shrinks them.</dd>
              <dt>I was signed out</dt><dd>That happens after an hour without activity, for safety. Sign in again.</dd>
              <dt>"Your account does not have permission"</dt><dd>Sign out and in again. If you use two-step verification, make sure you entered the code.</dd>
            </dl>
            <div className="note neutral" style={{ marginTop: 8 }}>
              <LifeBuoy /><span>Ready? <Link to="/stories/new" style={{ fontWeight: 800 }}>Write your first story <ArrowRight size={14} style={{ verticalAlign: -2 }} /></Link></span>
            </div>
          </Section>
        </article>
      </div>
    </>
  );
}
