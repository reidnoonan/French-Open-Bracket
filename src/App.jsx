import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://jlzgaqceleeseulndwnf.supabase.co",
  "sb_publishable_FDSoWRdj-7cnPQorDwW02w_HFmNxPvu"
);

const ADMIN_PASSWORD = "reid2026";

const POINTS = { r16: 2, qf: 4, sf: 8, champion: 20 };

const draw = [
  { id: "q1", label: "Top Quarter 1", matches: [["A. Sabalenka [1]", "N. Osaka [16]"], ["M. Keys [19]", "D. Shnaider [25]"]] },
  { id: "q2", label: "Top Quarter 2", matches: [["A. Potapova [28]", "A. Kalinskaya [22]"], ["M. Chwalinska", "D. Parry"]] },
  { id: "q3", label: "Bottom Quarter 1", matches: [["E. Svitolina [7]", "B. Bencic [11]"], ["M. Kostyuk [15]", "I. Swiatek [3]"]] },
  { id: "q4", label: "Bottom Quarter 2", matches: [["M. Andreeva [8]", "J. Teichmann"], ["S. Cirstea [18]", "X. Wang"]] }
];

const requiredKeys = [
  ...draw.flatMap(q => [`${q.id}-r16-1`, `${q.id}-r16-2`, `${q.id}-qf`]),
  "sf-top",
  "sf-bottom",
  "champion"
];

function score(picks, results) {
  let total = 0;
  draw.forEach(q => {
    [`${q.id}-r16-1`, `${q.id}-r16-2`].forEach(k => {
      if (results[k] && picks[k] === results[k]) total += POINTS.r16;
    });
    if (results[`${q.id}-qf`] && picks[`${q.id}-qf`] === results[`${q.id}-qf`]) total += POINTS.qf;
  });
  if (results["sf-top"] && picks["sf-top"] === results["sf-top"]) total += POINTS.sf;
  if (results["sf-bottom"] && picks["sf-bottom"] === results["sf-bottom"]) total += POINTS.sf;
  if (results.champion && picks.champion === results.champion) total += POINTS.champion;
  return total;
}

function App() {
  const [name, setName] = useState("");
  const [picks, setPicks] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [results, setResults] = useState({});
  const [admin, setAdmin] = useState(false);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const complete = useMemo(
    () => requiredKeys.every(k => picks[k]) && name.trim().length > 1,
    [picks, name]
  );

  async function loadData() {
    const subRes = await supabase.from("submissions").select("*").order("created_at", { ascending: true });
    const resRes = await supabase.from("results").select("winners").eq("id", 1).single();
    if (!subRes.error) setSubmissions(subRes.data || []);
    if (!resRes.error) setResults(resRes.data?.winners || {});
  }

  useEffect(() => {
    loadData();
  }, []);

  function setPick(key, value) {
    setPicks(prev => ({ ...prev, [key]: value }));
  }

  async function submitBracket() {
    setMessage("");
    const { error } = await supabase.from("submissions").insert([{ name: name.trim(), picks }]);
    if (error) {
      setMessage("Error submitting bracket: " + error.message);
      return;
    }
    setSubmitted(true);
    await loadData();
  }

  async function saveResults() {
    const { error } = await supabase.from("results").update({ winners: results }).eq("id", 1);
    setMessage(error ? "Error saving results: " + error.message : "Results saved.");
    await loadData();
  }

  const ranked = [...submissions].sort((a, b) => score(b.picks || {}, results) - score(a.picks || {}, results));

  if (admin) {
    return (
      <div className="page">
        <button onClick={() => setAdmin(false)}>Back</button>
        {!password || password !== ADMIN_PASSWORD ? (
          <div className="card small">
            <h2>Admin Login</h2>
            <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
        ) : (
          <>
            <h1>Admin Dashboard</h1>
            <p>{submissions.length} submissions</p>

            <div className="card">
              <h2>Enter Actual Results</h2>
              {draw.map(q => (
                <div key={q.id} className="quarter">
                  <h3>{q.label}</h3>
                  <Select label="R16 Match 1" val={results[`${q.id}-r16-1`]} setVal={v => setResults({ ...results, [`${q.id}-r16-1`]: v })} options={q.matches[0]} />
                  <Select label="R16 Match 2" val={results[`${q.id}-r16-2`]} setVal={v => setResults({ ...results, [`${q.id}-r16-2`]: v })} options={q.matches[1]} />
                  <Select label="Quarter Winner" val={results[`${q.id}-qf`]} setVal={v => setResults({ ...results, [`${q.id}-qf`]: v })} options={[results[`${q.id}-r16-1`], results[`${q.id}-r16-2`]].filter(Boolean)} />
                </div>
              ))}
              <Select label="Semifinal 1" val={results["sf-top"]} setVal={v => setResults({ ...results, "sf-top": v })} options={[results["q1-qf"], results["q2-qf"]].filter(Boolean)} />
              <Select label="Semifinal 2" val={results["sf-bottom"]} setVal={v => setResults({ ...results, "sf-bottom": v })} options={[results["q3-qf"], results["q4-qf"]].filter(Boolean)} />
              <Select label="Champion" val={results.champion} setVal={v => setResults({ ...results, champion: v })} options={[results["sf-top"], results["sf-bottom"]].filter(Boolean)} />
              <button onClick={saveResults}>Save Results</button>
            </div>

            <Leaderboard ranked={ranked} results={results} />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <button className="adminBtn" onClick={() => setAdmin(true)}>Admin</button>
      <h1>French Open Women’s Bracket Challenge</h1>
      <p><b>Scoring:</b> R16 = 2 · QF = 4 · SF = 8 · Champion = 20</p>

      {message && <p className="message">{message}</p>}

      {!submitted ? (
        <>
          <div className="card">
            <label>Your name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Example: Reid" />
          </div>

          {draw.map(q => <Quarter key={q.id} q={q} picks={picks} setPick={setPick} />)}

          <div className="card">
            <h2>Semifinals & Champion</h2>
            <PickGroup title="Semifinal 1" options={[picks["q1-qf"], picks["q2-qf"]].filter(Boolean)} selected={picks["sf-top"]} choose={v => setPick("sf-top", v)} />
            <PickGroup title="Semifinal 2" options={[picks["q3-qf"], picks["q4-qf"]].filter(Boolean)} selected={picks["sf-bottom"]} choose={v => setPick("sf-bottom", v)} />
            <PickGroup title="Champion" options={[picks["sf-top"], picks["sf-bottom"]].filter(Boolean)} selected={picks.champion} choose={v => setPick("champion", v)} />
          </div>

          <button disabled={!complete} onClick={submitBracket}>
            Submit & Unlock Everyone’s Picks
          </button>
        </>
      ) : (
        <>
          <div className="success">Bracket submitted. Everyone’s picks are now unlocked.</div>
          <Leaderboard ranked={ranked} results={results} />
        </>
      )}
    </div>
  );
}

function Quarter({ q, picks, setPick }) {
  const w1 = picks[`${q.id}-r16-1`];
  const w2 = picks[`${q.id}-r16-2`];
  return (
    <div className="card">
      <h2>{q.label}</h2>
      <PickGroup title="Round of 16 Match 1" options={q.matches[0]} selected={w1} choose={v => setPick(`${q.id}-r16-1`, v)} />
      <PickGroup title="Round of 16 Match 2" options={q.matches[1]} selected={w2} choose={v => setPick(`${q.id}-r16-2`, v)} />
      <PickGroup title="Quarter Winner" options={[w1, w2].filter(Boolean)} selected={picks[`${q.id}-qf`]} choose={v => setPick(`${q.id}-qf`, v)} />
    </div>
  );
}

function PickGroup({ title, options, selected, choose }) {
  return (
    <div className="group">
      <h3>{title}</h3>
      {options.length ? options.map(o => (
        <button key={o} className={selected === o ? "pick selected" : "pick"} onClick={() => choose(o)}>
          {o}
        </button>
      )) : <p className="muted">Pick prior winners first.</p>}
    </div>
  );
}

function Select({ label, val, setVal, options }) {
  return (
    <label className="selectLabel">
      {label}
      <select value={val || ""} onChange={e => setVal(e.target.value)}>
        <option value="">Not decided</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function Leaderboard({ ranked, results }) {
  return (
    <div className="card">
      <h2>Leaderboard / Everyone’s Picks</h2>
      {ranked.map((s, i) => (
        <details key={s.id} className="entry">
          <summary>#{i + 1} {s.name} — {score(s.picks || {}, results)}/68 pts</summary>
          <pre>{JSON.stringify(s.picks, null, 2)}</pre>
        </details>
      ))}
      {!ranked.length && <p>No submissions yet.</p>}
    </div>
  );
}

export default App;
