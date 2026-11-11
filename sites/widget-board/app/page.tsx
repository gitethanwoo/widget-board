import { getChatGPTUser, chatGPTSignInPath, chatGPTSignOutPath } from "./chatgpt-auth";
import { BoardWorkspace } from "./workspace";

export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await getChatGPTUser();
  return <main>
    <header className="topbar"><a className="brand" href="/"><span className="brand-icon" aria-hidden="true">▦</span> widget board<span className="beta">LAB</span></a>
      <div className="account"><span className="private-dot" /> Private workspace{user && <a href={chatGPTSignOutPath()} target="_top">Sign out</a>}</div>
    </header>
    <section className="intro"><div><p className="eyebrow">A HOME FOR THE LITTLE THINGS</p><h1>A little space<br />for anything<span>.</span></h1><p className="lede">A reminder. A number to watch. Something worth keeping close.<br className="desktop-break" /> Tell your agent what belongs here.</p></div>
      <div className="intro-note"><span aria-hidden="true">↗</span><p>Made in conversation.<br />Ready for a glance.</p></div>
    </section>
    <BoardWorkspace signedIn={!!user} signInPath={chatGPTSignInPath("/")} />
    <footer><span>Small canvas. Open possibilities.</span><span>Built for native iPhone widgets ↗</span></footer>
  </main>;
}
