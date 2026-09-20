import { useEffect, useState } from "react";
import api from "../../api/client";

export default function AdminDepartments() {
  const [departments, setDepartments] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  function load() {
    api.get("/admin/departments").then((res) => setDepartments(res.data));
  }
  useEffect(load, []);

  async function addDepartment(e) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/admin/departments", { name, description });
      setName("");
      setDescription("");
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not add department.");
    }
  }

  async function removeDepartment(id) {
    await api.delete(`/admin/departments/${id}`);
    load();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Departments</h1>
          <p>Group doctors by specialty area.</p>
        </div>
      </div>

      <div className="two-col">
        <div className="panel">
          {departments.length === 0 ? (
            <div className="empty-state">No departments yet.</div>
          ) : (
            <table>
              <thead><tr><th>Name</th><th>Description</th><th></th></tr></thead>
              <tbody>
                {departments.map((d) => (
                  <tr key={d.id}>
                    <td>{d.name}</td>
                    <td>{d.description || "—"}</td>
                    <td><button className="btn btn-danger" onClick={() => removeDepartment(d.id)}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <form className="panel" onSubmit={addDepartment}>
          <h3>Add department</h3>
          <div className="field"><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="field"><label>Description</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-primary" type="submit">Add department</button>
        </form>
      </div>
    </div>
  );
}
