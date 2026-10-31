import React from "react";
import { createRoot } from "react-dom/client";
import { DemoOutputCard } from "../../components/artifacts/demo-card";
import { Conversation, ConversationContent } from "../../components/ai-elements/conversation";

declare global { interface Window { fixtureHTML: string; fixtureFormat?: "components-v1" } }

function Fixture() {
	return <>
		<button id="theme" onClick={() => document.documentElement.classList.toggle("dark")}>Сменить тему</button>
		<Conversation initial="instant" className="fixture-chat">
			<ConversationContent>
				<div style={{ height: 700 }}>Текст перед демо</div>
				<DemoOutputCard output={{ title: "Как меняется площадь", html: window.fixtureHTML, format: window.fixtureFormat, tested: true }} />
				<p id="after">После демо: площадь растёт вместе со стороной квадрата.</p>
				<div style={{ height: location.search.includes("tail=short") ? 40 : 900 }}>Продолжение объяснения</div>
			</ConversationContent>
		</Conversation>
	</>;
}
createRoot(document.getElementById("fixture")!).render(<Fixture />);
