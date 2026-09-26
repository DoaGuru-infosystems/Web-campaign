const express = require("express");
const router = express.Router();
const { pool } = require("../db");
const { authMiddleware } = require("./auth");

// 1. Dashboard Global Stats
router.get("/dashboard", authMiddleware, async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    // Total Campaigns
    let totalCampsQuery = "SELECT COUNT(*) AS total_campaigns FROM campaigns";
    const totalCampsParams = [];
    if (req.user.role === "Employee") {
      totalCampsQuery +=
        " WHERE id IN (SELECT campaign_id FROM campaign_assignments WHERE user_id = ?)";
      totalCampsParams.push(req.user.id);
    }
    const [[{ total_campaigns }]] = await pool.query(
      totalCampsQuery,
      totalCampsParams,
    );

    // Active Campaigns (status = 'Published' and end_date >= today)
    let activeCampsQuery =
      "SELECT COUNT(*) AS active_campaigns FROM campaigns WHERE status = 'Published' AND end_date >= ?";
    const activeCampsParams = [today];
    if (req.user.role === "Employee") {
      activeCampsQuery +=
        " AND id IN (SELECT campaign_id FROM campaign_assignments WHERE user_id = ?)";
      activeCampsParams.push(req.user.id);
    }
    const [[{ active_campaigns }]] = await pool.query(
      activeCampsQuery,
      activeCampsParams,
    );

    // Total Registrations
    let totalRegsQuery =
      "SELECT COUNT(r.id) AS total_registrations FROM registrations r";
    const totalRegsParams = [];
    if (req.user.role === "Employee") {
      totalRegsQuery +=
        " WHERE r.campaign_id IN (SELECT campaign_id FROM campaign_assignments WHERE user_id = ?)";
      totalRegsParams.push(req.user.id);
    }
    const [[{ total_registrations }]] = await pool.query(
      totalRegsQuery,
      totalRegsParams,
    );

    // Registrations Today
    let regsTodayQuery =
      "SELECT COUNT(r.id) AS registrations_today FROM registrations r WHERE DATE(r.created_at) = ?";
    const regsTodayParams = [today];
    if (req.user.role === "Employee") {
      regsTodayQuery =
        "SELECT COUNT(r.id) AS registrations_today FROM registrations r WHERE DATE(r.created_at) = ? AND r.campaign_id IN (SELECT campaign_id FROM campaign_assignments WHERE user_id = ?)";
      regsTodayParams.push(req.user.id);
    }
    const [[{ registrations_today }]] = await pool.query(
      regsTodayQuery,
      regsTodayParams,
    );

    // Recent Campaigns (last 5)
    let recentCampsQuery = `
      SELECT c.*, COUNT(r.id) AS registrations_count
      FROM campaigns c
      LEFT JOIN registrations r ON c.id = r.campaign_id
    `;
    const recentCampsParams = [];
    if (req.user.role === "Employee") {
      recentCampsQuery +=
        " WHERE c.id IN (SELECT campaign_id FROM campaign_assignments WHERE user_id = ?)";
      recentCampsParams.push(req.user.id);
    }
    recentCampsQuery += `
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT 5
    `;
    const [recentCampaigns] = await pool.query(
      recentCampsQuery,
      recentCampsParams,
    );

    // Recent Participants (last 5)
    let recentPartsQuery = `
      SELECT r.id, r.registration_id, r.created_at, r.status, r.submitted_data, c.title AS campaign_title
      FROM registrations r
      JOIN campaigns c ON r.campaign_id = c.id
    `;
    const recentPartsParams = [];
    if (req.user.role === "Employee") {
      recentPartsQuery +=
        " WHERE c.id IN (SELECT campaign_id FROM campaign_assignments WHERE user_id = ?)";
      recentPartsParams.push(req.user.id);
    }
    recentPartsQuery += `
      ORDER BY r.created_at DESC
      LIMIT 5
    `;
    const [recentParticipants] = await pool.query(
      recentPartsQuery,
      recentPartsParams,
    );

    // Parse submitted_data for participants to extract basic fields like name/email
    const parsedParticipants = recentParticipants.map((rp) => {
      let dataObj = {};
      try {
        dataObj =
          typeof rp.submitted_data === "string"
            ? JSON.parse(rp.submitted_data)
            : rp.submitted_data || {};
      } catch (e) {}
      if (!dataObj || typeof dataObj !== "object") {
        dataObj = {};
      }

      // Try to find a name or email field dynamically
      let name = "Participant";
      let contact = "";

      for (const [key, val] of Object.entries(dataObj)) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes("name") &&
          typeof val === "string" &&
          name === "Participant"
        ) {
          name = val;
        }
        if (
          (lowerKey.includes("email") || lowerKey.includes("phone")) &&
          typeof val === "string" &&
          !contact
        ) {
          contact = val;
        }
      }

      return {
        id: rp.id,
        registration_id: rp.registration_id,
        campaign_title: rp.campaign_title,
        created_at: rp.created_at,
        status: rp.status,
        name,
        contact,
      };
    });

    res.json({
      stats: {
        total_campaigns,
        active_campaigns,
        total_registrations,
        registrations_today,
      },
      recent_campaigns: recentCampaigns,
      recent_participants: parsedParticipants,
    });
  } catch (err) {
    console.error("Error fetching dashboard stats:", err);
    res.status(500).json({ error: "Failed to retrieve dashboard stats" });
  }
});

// 2. Charts Data
router.get("/charts", authMiddleware, async (req, res) => {
  try {
    // Campaign-wise registrations
    let campaignWiseQuery = `
      SELECT c.title AS campaign_title, COUNT(r.id) AS value
      FROM campaigns c
      JOIN registrations r ON c.id = r.campaign_id
    `;
    const campaignWiseParams = [];
    if (req.user.role === "Employee") {
      campaignWiseQuery +=
        " WHERE c.id IN (SELECT campaign_id FROM campaign_assignments WHERE user_id = ?)";
      campaignWiseParams.push(req.user.id);
    }
    campaignWiseQuery += " GROUP BY c.id ORDER BY value DESC LIMIT 10";
    const [campaignWise] = await pool.query(
      campaignWiseQuery,
      campaignWiseParams,
    );

    // Daily registrations (last 14 days)
    let dailyRegsQuery = `
      SELECT DATE_FORMAT(r.created_at, '%Y-%m-%d') AS date, COUNT(r.id) AS count
      FROM registrations r
    `;
    const dailyRegsParams = [];
    if (req.user.role === "Employee") {
      dailyRegsQuery +=
        " WHERE r.campaign_id IN (SELECT campaign_id FROM campaign_assignments WHERE user_id = ?) AND r.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)";
      dailyRegsParams.push(req.user.id);
    } else {
      dailyRegsQuery +=
        " WHERE r.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)";
    }
    dailyRegsQuery +=
      " GROUP BY DATE_FORMAT(r.created_at, '%Y-%m-%d') ORDER BY date ASC";
    const [dailyRegs] = await pool.query(dailyRegsQuery, dailyRegsParams);

    // Monthly registrations growth (current year)
    let monthlyGrowthQuery = `
      SELECT DATE_FORMAT(r.created_at, '%b') AS month, COUNT(r.id) AS count
      FROM registrations r
    `;
    const monthlyGrowthParams = [];
    if (req.user.role === "Employee") {
      monthlyGrowthQuery +=
        " WHERE r.campaign_id IN (SELECT campaign_id FROM campaign_assignments WHERE user_id = ?) AND YEAR(r.created_at) = YEAR(NOW())";
      monthlyGrowthParams.push(req.user.id);
    } else {
      monthlyGrowthQuery += " WHERE YEAR(r.created_at) = YEAR(NOW())";
    }
    monthlyGrowthQuery +=
      " GROUP BY MONTH(r.created_at), DATE_FORMAT(r.created_at, '%b') ORDER BY MONTH(r.created_at) ASC";
    const [monthlyGrowth] = await pool.query(
      monthlyGrowthQuery,
      monthlyGrowthParams,
    );

    // Category-wise performance
    let categoryWiseQuery = `
      SELECT c.category AS name, COUNT(r.id) AS value
      FROM campaigns c
      JOIN registrations r ON c.id = r.campaign_id
    `;
    const categoryWiseParams = [];
    if (req.user.role === "Employee") {
      categoryWiseQuery +=
        " WHERE c.id IN (SELECT campaign_id FROM campaign_assignments WHERE user_id = ?)";
      categoryWiseParams.push(req.user.id);
    }
    categoryWiseQuery += " GROUP BY c.category ORDER BY value DESC";
    const [categoryWise] = await pool.query(
      categoryWiseQuery,
      categoryWiseParams,
    );

    res.json({
      campaign_wise: campaignWise,
      daily: dailyRegs,
      monthly: monthlyGrowth,
      category_wise: categoryWise,
    });
  } catch (err) {
    console.error("Error fetching chart data:", err);
    res.status(500).json({ error: "Failed to retrieve charts analytics" });
  }
});

// 3. Notifications List
router.get("/notifications", authMiddleware, async (req, res) => {
  try {
    const [notifications] = await pool.query(
      "SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50",
    );
    res.json({ notifications });
  } catch (err) {
    console.error("Error fetching notifications:", err);
    res.status(500).json({ error: "Failed to retrieve notifications" });
  }
});

// 4. Mark notifications read
router.post("/notifications/read", authMiddleware, async (req, res) => {
  try {
    await pool.query("UPDATE notifications SET is_read = 1");
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    console.error("Error marking notifications read:", err);
    res.status(500).json({ error: "Failed to mark notifications as read" });
  }
});

module.exports = router;
