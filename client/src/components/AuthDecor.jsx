// Decorative 3D background for auth pages: floating gradient orbs (depth)
// + CSS butterflies flapping their wings along flight paths. Pure CSS,
// pointer-events none so it never blocks the form.
export default function AuthDecor() {
  return (
    <div className="auth-decor" aria-hidden="true">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
      <div className="butterfly b1">
        <span className="wing left" />
        <span className="bfly-body" />
        <span className="wing right" />
      </div>
      <div className="butterfly b2">
        <span className="wing left" />
        <span className="bfly-body" />
        <span className="wing right" />
      </div>
      <div className="butterfly b3">
        <span className="wing left" />
        <span className="bfly-body" />
        <span className="wing right" />
      </div>
    </div>
  );
}
