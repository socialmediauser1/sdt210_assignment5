import { Outlet, NavLink } from "react-router-dom";

export default function Layout() {
  return (
    <>
      <nav
        style={{
          padding: "1rem 1.5rem",
          borderBottom: "1px solid #eee",
          display: "flex",
          gap: "1rem",
        }}
      >
        <NavLink
          to="/"
          end
          style={({ isActive }) => ({ fontWeight: isActive ? "bold" : "normal" })}
        >
          Board
        </NavLink>
        <NavLink
          to="/archive"
          style={({ isActive }) => ({ fontWeight: isActive ? "bold" : "normal" })}
        >
          Archive
        </NavLink>
        <NavLink
          to="/stats"
          style={({ isActive }) => ({ fontWeight: isActive ? "bold" : "normal" })}
        >
          Stats
        </NavLink>
      </nav>
      <main style={{ padding: "1.5rem" }}>
        <Outlet />
      </main>
    </>
  );
}
