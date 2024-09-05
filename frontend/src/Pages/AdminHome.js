import React from 'react';
import CreateService from '../Components/CreateService';
import AvailableServices from '../Components/AvailableServices';
import { useState,useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
const AdminHome = () => {
  const [auth, setAuth] = useState(false);
  
const [customers, setCustomers] = useState([]);
const [selectedCustomer, setSelectedCustomer] = useState(null);
const navigate= useNavigate();
useEffect(() => {
  axios.get('http://localhost:8081/customers')
    .then(res => {
      console.log(res.data); 
      if (Array.isArray(res.data)) {
        setCustomers(res.data);
      } else {
        console.error("Expected an array, but got:", res.data);
        setCustomers([]); // Avoid setting it to a non-array
      }
    })
    .catch(err => console.error("Error fetching customers:", err));
}, []);

  const handleLogout = () => {
    axios.get('http://localhost:8081/logout')
      .then(res => {
        if (res.data.Status === "Success") {
          setAuth(false);
          navigate('/logout');
        } else {
          console.log("Logout failed:", res.data.Error);
        }
      })
      .catch(err => console.log(err));
  };

  const viewCustomerDetails = (id) => {
    axios.get(`http://localhost:8081/customer/${id}`)
      .then(res => {  
        if (res.data) {
          setSelectedCustomer(res.data);
          console.log(selectedCustomer)
        }
      })
      .catch(err => console.error("Error fetching customer details:", err));
  };

  const removeCustomer = (id) => {
    axios.delete(`http://localhost:8081/customer/${id}`)
      .then(res => {
        if (res.data.Status === "Customer removed successfully") {
          // Refresh the customer list
          setCustomers(customers.filter(customer => customer.id !== id));
          setSelectedCustomer(null);
        }
      })
      .catch(err => console.error("Error removing customer:", err));
  };
  return (
    <div>
      <button onClick={handleLogout}>Logout</button>
      <div>
        <Link to="/archive">
          <button className="archive-button">View Archived Services</button>
        </Link>
      </div>
      <AvailableServices />
      <h2>Create a New Service</h2>
      <CreateService />
      {/* <UpdateService /> */}
      
      <h2>Customer List</h2>
      <ul>
        {Array.isArray(customers) ? (
          customers.map(customer => (
            <li key={customer.id}>
              <span>{customer.name} ({customer.email})</span>
              <button onClick={() => viewCustomerDetails(customer.id)}>View Details</button>
              <button onClick={() => removeCustomer(customer.id)}>Remove</button>
            </li>
          ))
        ) : (
          <li>No customers available</li>
        )}
      </ul>
      
  
      {selectedCustomer && (
        <div>
          <h3>Customer Details</h3>
          <p>Name: {selectedCustomer.name}</p>
          <p>Email: {selectedCustomer.email}</p>
          <h4>Enrolled Services</h4>
          <ul>
            {selectedCustomer.services_enrolled.map((service, index) => (
              <li key={index}>
                {service.service_name} - {service.plan} (Features: {service.features})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
  
};

export default AdminHome;
