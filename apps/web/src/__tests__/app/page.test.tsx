import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

// ---------------------------------------------------------------------------
// Home page component tests
// ---------------------------------------------------------------------------
describe("Home page", () => {
  it("renders the CrudCraft heading", () => {
    render(<Home />);
    expect(screen.getByText("CrudCraft")).toBeInTheDocument();
  });

  it("renders the subtitle description", () => {
    render(<Home />);
    expect(
      screen.getByText(/Simple full-stack CRUD demo/i),
    ).toBeInTheDocument();
  });

  it("renders a link to the tasks page", () => {
    render(<Home />);
    const tasksLink = screen.getByRole("link", { name: /open tasks/i });
    expect(tasksLink).toBeInTheDocument();
    expect(tasksLink).toHaveAttribute("href", "/tasks");
  });

  it("renders a link to the API health endpoint", () => {
    render(<Home />);
    const healthLink = screen.getByRole("link", { name: /api health/i });
    expect(healthLink).toBeInTheDocument();
    expect(healthLink).toHaveAttribute("href", "http://localhost:4000/api/health");
  });

  it("API health link opens in a new tab", () => {
    render(<Home />);
    const healthLink = screen.getByRole("link", { name: /api health/i });
    expect(healthLink).toHaveAttribute("target", "_blank");
  });

  it("API health link has rel=noreferrer for security", () => {
    render(<Home />);
    const healthLink = screen.getByRole("link", { name: /api health/i });
    expect(healthLink).toHaveAttribute("rel", "noreferrer");
  });

  it("renders exactly two links", () => {
    render(<Home />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
  });

  it("renders a main element as the top-level container", () => {
    render(<Home />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});