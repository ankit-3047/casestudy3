import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
const ArchiveTable = () => {
  const [archives, setArchives] = useState([]);
const navigate=useNavigate();
  useEffect(() => {
    // Fetch the archived data from the backend
    const fetchArchives = async () => {
      try {
        const response = await axios.get("http://localhost:8081/archives");
        setArchives(response.data);
        console.log(response.data)
      } catch (error) {
        console.error("Error fetching archive data:", error);
      }
    };

    fetchArchives();
  }, []);
  const handleGoBack = () => {
    navigate(-1); // Navigate to the previous page
  };
  return (
    <div className="archive-table">
    <button onClick={handleGoBack}>Go Back</button> {/* Add the "Go Back" button */}
      <h2>Archived Services</h2>
      <table>
        <thead>
          <tr>
            <th>Customer ID</th>
            <th>Customer Name</th>
            <th>Service ID</th>
            <th>Plan Name</th>
            <th>Features</th>
            <th>Archived At</th>
          </tr>
        </thead>
        <tbody>
          {archives.length > 0 ? (
            archives.map((archive) => (
              <tr key={archive.id}>
                <td>{archive.customer_id}</td>
                <td>{archive.customer_name}</td>
                <td>{archive.service_id}</td>
                <td>{archive.plan_name}</td>
                <td>{archive.features || "N/A"}</td>
                <td>{new Date(archive.updatedAt).toLocaleString()}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6">No archived services found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ArchiveTable;
