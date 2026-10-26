// the decoration behind every page. Which piece shows is picked by
// <html data-bg> in styles/backdrop.css, chosen from the settings menu
export default function Backdrop() {
  return (
    <div className="backdrop" aria-hidden>
      <span className="backdrop-sfx">ドン</span>
      <span className="backdrop-panel" />
      <span className="backdrop-panel" />
      <span className="backdrop-panel" />
      <span className="backdrop-panel" />
    </div>
  );
}
