import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "../../../services/api";

function Snackveg() {
  const [data, setdata] = useState([]);
  const [error, seterror] = useState("");

  const BASEAPI = "https://afmc.globalsparkteksolutions.com/AFMCIMAGES/";

  useEffect(() => {
    fetchdata();
  }, []);

  const fetchdata = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/Snacksveg`);
      const result = await response.json();
      setdata(result.data || []);
    } catch (error) {
      console.log("error", error);
      seterror(error.message);
    }
  };

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div style={{ padding: "20px", background: "#f5f5f5" }}>

      {/* Top Tabs */}
      <div style={styles.tabContainer}>
        <div style={styles.tab}>Drinks</div>
        <div style={{ ...styles.tab, ...styles.activeTab }}>Snacks</div>
      </div>

      {/* Sub Tabs */}
      <div style={styles.tabContainer}>
        <div style={{ ...styles.tab, ...styles.activeTab }}>Veg</div>
        <div style={styles.tab}>Non Veg</div>
      </div>

      {/* Filter */}
      <div style={styles.filterBox}>
        <div>
          <label>Item Name</label>
          <select style={styles.select}>
            <option>Select Item</option>
            {data.map((item, index) => (
              <option key={index}>{item.item_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Items Grid */}
      <div style={styles.grid}>
        {data.map((item, index) => (
          <div key={index} style={styles.card}>

            {/* Image */}
            <img
              src={`${BASEAPI}${item.image}`}
              alt={item.item_name}
              style={styles.image}
            />

            {/* Name */}
            <div style={styles.itemName}>
              {item.item_name}
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}

export default Snackveg;

const styles = {
  tabContainer: {
    display: "flex",
    gap: "20px",
    marginBottom: "15px",
  },
  tab: {
    padding: "10px 20px",
    borderRadius: "8px",
    background: "#e0e0e0",
    cursor: "pointer",
  },
  activeTab: {
    borderBottom: "3px solid green",
    background: "#fff",
  },
  filterBox: {
    display: "flex",
    gap: "40px",
    marginBottom: "20px",
    background: "#fff",
    padding: "15px",
    borderRadius: "10px",
  },
  select: {
    display: "block",
    padding: "8px",
    marginTop: "5px",
    minWidth: "200px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: "20px",
  },
  card: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "#fff",
    padding: "12px",
    borderRadius: "10px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
  },
  image: {
    width: "40px",
    height: "40px",
    borderRadius: "6px",
    objectFit: "cover",
  },
  itemName: {
    fontSize: "14px",
    fontWeight: "500",
  },
};
