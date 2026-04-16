import React, { useEffect, useState } from "react";

function EnduserOther() {
  const [data, setdata] = useState([]);
    const [error, seterror] = useState("");
    
    const BASEAPI = "https://afmc.globalsparkteksolutions.com/AFMCIMAGES/"

  useEffect(() => {
    fetchdata();
  }, []);

  const fetchdata = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/menubar");
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
        <div style={{ ...styles.tab, ...styles.activeTab }}>Drinks</div>
        <div style={styles.tab}>Snacks</div>
      </div>

      {/* Sub Tabs */}
      <div style={styles.tabContainer}>
        <div style={{ ...styles.tab, ...styles.activeTab }}>Soft Drinks</div>
        <div style={styles.tab}>Hard Drinks</div>
      </div>

      {/* Category Tabs */}
      <div style={styles.categoryTabs}>
        <span style={styles.activeCategory}>Others</span>
        <span>Mocktail</span>
      </div>

      {/* Filters */}
      <div style={styles.filterBox}>
        <div>
          <label>Category</label>
          <select style={styles.select}>
            <option>All Categories</option>
          </select>
        </div>

        <div>
          <label>Item Name</label>
          <select style={styles.select}>
            <option>Select Item</option>
          </select>
        </div>
      </div>

      {/* Items Grid */}
      <div style={styles.grid}>
        {data.map((item, index) => (
         <div key={index} style={styles.card}>
  
  <img
    src={`${BASEAPI}${item.image || "default.jpg"}`}
    alt={item.item_name}
    style={styles.image}
  />

  <div style={styles.itemName}>
    {item.item_name}
  </div>

</div>
        ))}
      </div>
    </div>
  );
}

export default EnduserOther;

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
  categoryTabs: {
    display: "flex",
    gap: "20px",
    marginBottom: "20px",
  },
  activeCategory: {
    borderBottom: "2px solid green",
    paddingBottom: "5px",
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
    },
  image: {
  width: "40px",
  height: "40px",
  borderRadius: "8px",
  objectFit: "cover",
},
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "20px",
  },
  card: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "#fff",
    padding: "15px",
    borderRadius: "12px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
  },
  iconBox: {
    width: "40px",
    height: "40px",
    borderRadius: "8px",
    background: "#ffd54f",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
  },
  itemName: {
    fontWeight: "500",
  },
};