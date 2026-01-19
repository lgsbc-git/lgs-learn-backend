const { getDbPool } = require("../../config/db");

/* =========================
   GET ALL TEAMS
========================= */
exports.getAllTeams = async (req, res) => {
  try {
    const managerId = req.user.id;
    const pool = await getDbPool();

    const result = await pool.request().input("managerId", managerId).query(`
      SELECT 
        t.id,
        t.teamName,
        t.description,
        t.departmentName,
        t.teamSize,
        t.createdAt,
        t.updatedAt,
        COUNT(tm.id) AS memberCount
      FROM Teams t
      LEFT JOIN TeamMembers tm ON tm.teamId = t.id
      WHERE t.managerId = @managerId
      GROUP BY t.id, t.teamName, t.description, t.departmentName, t.teamSize, t.createdAt, t.updatedAt
      ORDER BY t.createdAt DESC
    `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   CREATE TEAM
========================= */
exports.createTeam = async (req, res) => {
  try {
    const managerId = req.user.id;
    const { teamName, description, departmentName } = req.body;

    // Validation
    if (!teamName || !teamName.trim()) {
      return res.status(400).json({ message: "Team name is required" });
    }

    const pool = await getDbPool();

    // Check for duplicate team name
    const duplicateCheck = await pool
      .request()
      .input("managerId", managerId)
      .input("teamName", teamName.trim())
      .query(
        `SELECT id FROM Teams WHERE managerId = @managerId AND teamName = @teamName`,
      );

    if (duplicateCheck.recordset.length > 0) {
      return res
        .status(400)
        .json({ message: "Team name already exists for this manager" });
    }

    // Create team
    const result = await pool
      .request()
      .input("managerId", managerId)
      .input("teamName", teamName.trim())
      .input("description", description || null)
      .input("departmentName", departmentName || null).query(`
      INSERT INTO Teams (managerId, teamName, description, departmentName, teamSize)
      VALUES (@managerId, @teamName, @description, @departmentName, 0);
      
      SELECT SCOPE_IDENTITY() AS id;
    `);

    const teamId = result.recordset[0].id;

    // Return created team
    const teamResult = await pool.request().input("teamId", teamId).query(`
      SELECT 
        id,
        teamName,
        description,
        departmentName,
        teamSize,
        createdAt
      FROM Teams
      WHERE id = @teamId
    `);

    res.status(201).json(teamResult.recordset[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   GET TEAM DETAILS
========================= */
exports.getTeamDetails = async (req, res) => {
  try {
    const { teamId } = req.params;
    const managerId = req.user.id;
    const pool = await getDbPool();

    // Get team details
    const teamResult = await pool
      .request()
      .input("teamId", teamId)
      .input("managerId", managerId).query(`
      SELECT 
        t.id,
        t.teamName,
        t.description,
        t.departmentName,
        t.teamSize,
        t.createdAt,
        t.updatedAt,
        COUNT(tm.id) AS memberCount
      FROM Teams t
      LEFT JOIN TeamMembers tm ON tm.teamId = t.id
      WHERE t.id = @teamId AND t.managerId = @managerId
      GROUP BY t.id, t.teamName, t.description, t.departmentName, t.teamSize, t.createdAt, t.updatedAt
    `);

    if (teamResult.recordset.length === 0) {
      return res.status(404).json({ message: "Team not found" });
    }

    const team = teamResult.recordset[0];

    // Get team members with their course progress
    const membersResult = await pool.request().input("teamId", teamId).query(`
      SELECT 
        u.id,
        u.name AS name,
        u.email,
        u.role,
        tm.roleInTeam,
        tm.addedAt
      FROM TeamMembers tm
      JOIN Users u ON u.id = tm.userId
      WHERE tm.teamId = @teamId
      ORDER BY u.name
    `);

    res.json({
      ...team,
      members: membersResult.recordset,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   UPDATE TEAM
========================= */
exports.updateTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const managerId = req.user.id;
    const { teamName, description, departmentName } = req.body;

    const pool = await getDbPool();

    // Check if team exists and belongs to manager
    const existingTeam = await pool
      .request()
      .input("teamId", teamId)
      .input("managerId", managerId)
      .query(
        `SELECT id FROM Teams WHERE id = @teamId AND managerId = @managerId`,
      );

    if (existingTeam.recordset.length === 0) {
      return res.status(404).json({ message: "Team not found" });
    }

    // Update team
    await pool
      .request()
      .input("teamId", teamId)
      .input("teamName", teamName || null)
      .input("description", description || null)
      .input("departmentName", departmentName || null).query(`
      UPDATE Teams
      SET 
        teamName = COALESCE(@teamName, teamName),
        description = COALESCE(@description, description),
        departmentName = COALESCE(@departmentName, departmentName),
        updatedAt = GETUTCDATE()
      WHERE id = @teamId
    `);

    // Return updated team
    const result = await pool.request().input("teamId", teamId).query(`
      SELECT 
        id,
        teamName,
        description,
        departmentName,
        teamSize,
        createdAt,
        updatedAt
      FROM Teams
      WHERE id = @teamId
    `);

    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   DELETE TEAM
========================= */
exports.deleteTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const managerId = req.user.id;
    const pool = await getDbPool();

    // Check if team exists and belongs to manager
    const existingTeam = await pool
      .request()
      .input("teamId", teamId)
      .input("managerId", managerId)
      .query(
        `SELECT id FROM Teams WHERE id = @teamId AND managerId = @managerId`,
      );

    if (existingTeam.recordset.length === 0) {
      return res.status(404).json({ message: "Team not found" });
    }

    // Delete team (will cascade delete team members via FK)
    await pool.request().input("teamId", teamId).query(`
      DELETE FROM Teams WHERE id = @teamId
    `);

    res.json({ message: "Team deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   ADD TEAM MEMBERS
========================= */
exports.addTeamMembers = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { userIds } = req.body;
    const managerId = req.user.id;

    // Validation
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: "User IDs are required" });
    }

    const pool = await getDbPool();

    // Check if team exists and belongs to manager
    const existingTeam = await pool
      .request()
      .input("teamId", teamId)
      .input("managerId", managerId)
      .query(
        `SELECT id FROM Teams WHERE id = @teamId AND managerId = @managerId`,
      );

    if (existingTeam.recordset.length === 0) {
      return res.status(404).json({ message: "Team not found" });
    }

    // Add users to team via TeamMembers table
    let addedCount = 0;
    for (const userId of userIds) {
      try {
        await pool.request().input("teamId", teamId).input("userId", userId)
          .query(`
            INSERT INTO TeamMembers (teamId, userId, roleInTeam)
            VALUES (@teamId, @userId, 'EMPLOYEE')
          `);
        addedCount++;
      } catch (err) {
        // Skip if member already exists (UNIQUE constraint violation)
        if (!err.message.includes("UNIQUE")) {
          throw err;
        }
      }
    }

    // Get updated member count
    const memberCountResult = await pool
      .request()
      .input("teamId", teamId)
      .query(
        `SELECT COUNT(*) AS memberCount FROM TeamMembers WHERE teamId = @teamId`,
      );

    const memberCount = memberCountResult.recordset[0].memberCount;
    await pool
      .request()
      .input("teamId", teamId)
      .input("newSize", memberCount)
      .query(`UPDATE Teams SET teamSize = @newSize WHERE id = @teamId`);

    res.json({
      message: `${addedCount} members added successfully`,
      memberCount,
      addedCount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   REMOVE TEAM MEMBERS
========================= */
exports.removeTeamMembers = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { userIds } = req.body;
    const managerId = req.user.id;

    // Validation
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: "User IDs are required" });
    }

    const pool = await getDbPool();

    // Check if team exists and belongs to manager
    const existingTeam = await pool
      .request()
      .input("teamId", teamId)
      .input("managerId", managerId)
      .query(
        `SELECT id FROM Teams WHERE id = @teamId AND managerId = @managerId`,
      );

    if (existingTeam.recordset.length === 0) {
      return res.status(404).json({ message: "Team not found" });
    }

    // Remove users from team via TeamMembers table
    for (const userId of userIds) {
      await pool
        .request()
        .input("teamId", teamId)
        .input("userId", userId)
        .query(
          `DELETE FROM TeamMembers WHERE teamId = @teamId AND userId = @userId`,
        );
    }

    // Get updated member count
    const memberCountResult = await pool
      .request()
      .input("teamId", teamId)
      .query(
        `SELECT COUNT(*) AS memberCount FROM TeamMembers WHERE teamId = @teamId`,
      );

    const memberCount = memberCountResult.recordset[0].memberCount;
    await pool
      .request()
      .input("teamId", teamId)
      .input("newSize", memberCount)
      .query(`UPDATE Teams SET teamSize = @newSize WHERE id = @teamId`);

    res.json({
      message: `${userIds.length} members removed successfully`,
      memberCount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   GET AVAILABLE EMPLOYEES
========================= */
exports.getAvailableEmployees = async (req, res) => {
  try {
    const { teamId } = req.params;
    const managerId = req.user.id;
    const pool = await getDbPool();

    // Check if team exists and belongs to manager
    const teamExists = await pool
      .request()
      .input("teamId", teamId)
      .input("managerId", managerId)
      .query(
        `SELECT id FROM Teams WHERE id = @teamId AND managerId = @managerId`,
      );

    if (teamExists.recordset.length === 0) {
      return res.status(404).json({ message: "Team not found" });
    }

    // Get employees not yet in this team
    const result = await pool.request().input("teamId", teamId).query(`
        SELECT 
          u.id,
          u.name,
          u.email,
          u.role
        FROM Users u
        WHERE u.role = 'employee' 
          AND u.id NOT IN (
            SELECT userId FROM TeamMembers WHERE teamId = @teamId
          )
        ORDER BY u.name
      `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   GET ALL EMPLOYEES
========================= */
exports.getAllEmployees = async (req, res) => {
  try {
    const pool = await getDbPool();

    // Get all employees in the system
    const result = await pool.request().query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role
      FROM Users u
      WHERE u.role = 'employee'
      ORDER BY u.name
    `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   UPDATE MEMBER ROLE
========================= */
exports.updateMemberRole = async (req, res) => {
  try {
    const { teamId, userId } = req.params;
    const { roleInTeam } = req.body;
    const managerId = req.user.id;

    // Validation
    const validRoles = ["EMPLOYEE", "TEAM_LEAD", "MANAGER"];
    if (!roleInTeam || !validRoles.includes(roleInTeam)) {
      return res.status(400).json({
        message: `Invalid role. Must be one of: ${validRoles.join(", ")}`,
      });
    }

    const pool = await getDbPool();

    // Check if team exists and belongs to manager
    const teamExists = await pool
      .request()
      .input("teamId", teamId)
      .input("managerId", managerId)
      .query(
        `SELECT id FROM Teams WHERE id = @teamId AND managerId = @managerId`,
      );

    if (teamExists.recordset.length === 0) {
      return res.status(404).json({ message: "Team not found" });
    }

    // Check if member exists in team
    const memberExists = await pool
      .request()
      .input("teamId", teamId)
      .input("userId", userId)
      .query(
        `SELECT id FROM TeamMembers WHERE teamId = @teamId AND userId = @userId`,
      );

    if (memberExists.recordset.length === 0) {
      return res.status(404).json({ message: "Member not found in team" });
    }

    // Update member role
    await pool
      .request()
      .input("teamId", teamId)
      .input("userId", userId)
      .input("roleInTeam", roleInTeam).query(`
        UPDATE TeamMembers 
        SET roleInTeam = @roleInTeam 
        WHERE teamId = @teamId AND userId = @userId
      `);

    res.json({ message: "Member role updated successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
