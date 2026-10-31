import "../../components/chat-width-rails.css";
import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ChatWidthRails } from "../../components/chat-width-rails";
function Fixture() {
 const ref = useRef<HTMLDivElement>(null);
 const feedRef = useRef<HTMLDivElement>(null);
 const [rails, setRails] = useState(true);
 const [sidebar, setSidebar] = useState(true);
 return <><button id="rails" onClick={() => setRails(!rails)}>Toggle rails</button><button id="sidebar" onClick={() => setSidebar(!sidebar)}>Sidebar</button><div ref={ref} id="scope" style={{ position: "relative", marginLeft: sidebar ? 240 : 0, height: 700 }}>
 <div ref={feedRef} id="feed" style={{ boxSizing: "border-box", width: "100%", maxWidth: "100%", padding: "0 24px", margin: "auto" }}>
 <p>Объяснение с интерактивной визуализацией</p><iframe title="demo" style={{ width: "100%", height: 350, border: 0 }} srcDoc="<body style='background:#888'>Визуализация</body>" />
 </div><div id="dock" style={{ position: "absolute", bottom: 0, width: 400, left: "50%", transform: "translateX(-50%)" }}>Поле ввода</div>
 {rails && <ChatWidthRails scopeRef={ref} feedRef={feedRef} bottom={100} />}</div></>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
