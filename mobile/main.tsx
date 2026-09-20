import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import PayApp from "../components/PayApp";
import { analyseLocal, listReceivers } from "../lib/local";

function App() {
  const [handles, setHandles] = useState<{ handle: string; name: string }[]>([]);
  useEffect(() => { listReceivers().then(setHandles).catch(() => setHandles([])); }, []);
  return <PayApp handles={handles} analyse={analyseLocal} />;
}

createRoot(document.getElementById("root")!).render(<App />);
