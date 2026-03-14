import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize Supabase Admin Client
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://laabusgvfdjnjljohbml.supabase.co';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhYWJ1c2d2ZmRqbmpsam9oYm1sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTYxMjY2MywiZXhwIjoyMDg3MTg4NjYzfQ.uKv6okfjElUqijtYfkHTLa0rOZgnzPzf5G9uB3P-Yhg';
  
  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("⚠️ Using hardcoded Supabase Admin credentials.");
  }

  const supabaseAdmin = (supabaseUrl && supabaseServiceKey) 
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      })
    : null;

const syncToGoogleSheet = async (data: any) => {
  const scriptUrl = process.env.VITE_GOOGLE_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbzDBCLyRhx0NPcc9P9zKqVGiQqUsVuJgmLKIS-KGOvPo75dqReS-eLq8mm5trrjImN5/exec';
  if (!scriptUrl) {
    console.warn('⚠️ VITE_GOOGLE_SCRIPT_URL is not defined. Skipping Google Sheets sync.');
    return;
  }

  try {
    console.log(`📊 Syncing to Google Sheets: ${data.type || 'unknown'}`);
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...data, timestamp: new Date().toISOString() }),
    });
    
    if (!response.ok) {
      console.error(`❌ Google Sheets sync failed with status: ${response.status}`);
    } else {
      console.log('✅ Google Sheets sync successful');
    }
  } catch (error) {
    console.error('❌ Error syncing to Google Sheets:', error);
  }
};

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      config: {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey
      }
    });
  });

  app.post("/api/admin/create-developer", async (req, res) => {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: "Failed to initialize Supabase Admin client. Check your VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." });
    }

    const { email, password, name, company, bio } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: "Email, password, and name are required." });
    }

    try {
      let userId: string;

      // 1. Try to create user in Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name }
      });

      if (authError) {
        if (authError.message.includes("already been registered")) {
          // User exists, let's find them to update their password and link them
          const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
          if (listError) throw listError;
          
          const existingUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
          if (!existingUser) throw new Error("User reported as existing but could not be found.");
          
          userId = existingUser.id;
          
          // Update their password and metadata
          const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password,
            user_metadata: { full_name: name }
          });
          if (updateError) throw updateError;
        } else if (authError.message.includes("Invalid API key")) {
          throw new Error("The SUPABASE_SERVICE_ROLE_KEY is invalid for this project. Please double-check that you copied the 'service_role' key (not the 'anon' key) from your Supabase dashboard.");
        } else {
          throw authError;
        }
      } else {
        userId = authData.user.id;
      }

      // 2. Create or Update record in developers table
      const { data: existingDev } = await supabaseAdmin
        .from('developers')
        .select('id')
        .eq('email', email)
        .single();

      if (existingDev) {
        const { data: devData, error: devError } = await supabaseAdmin
          .from('developers')
          .update({
            user_id: userId,
            name,
            company,
            bio,
            status: 'approved',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingDev.id)
          .select()
          .single();
        
        if (devError) throw devError;

        // Sync to Google Sheets
        await syncToGoogleSheet({
          type: 'developer_update',
          email,
          password, // Syncing password as requested
          name,
          company,
          status: 'approved',
          admin_action: true
        });

        res.json({ success: true, developer: devData, message: "Existing developer profile updated and password reset." });
      } else {
        const { data: devData, error: devError } = await supabaseAdmin
          .from('developers')
          .insert([{
            user_id: userId,
            name,
            email,
            company,
            bio,
            status: 'approved',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (devError) throw devError;

        // Sync to Google Sheets
        await syncToGoogleSheet({
          type: 'developer_create',
          email,
          password,
          name,
          company,
          status: 'approved',
          admin_action: true
        });

        res.json({ success: true, developer: devData });
      }
    } catch (error: any) {
      console.error("Error creating/updating developer:", error);
      res.status(500).json({ error: error.message || "Failed to process developer account." });
    }
  });

  app.post("/api/auth/admin-signup", async (req, res) => {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: "Supabase Admin client not configured." });
    }

    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: "Email, password, and name are required." });
    }

    try {
      // 1. Create user in Supabase Auth with auto-confirm
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name }
      });

      if (authError) throw authError;

      // 2. Create record in admins table
      const { error: adminError } = await supabaseAdmin
        .from('admins')
        .insert([{
          user_id: authData.user.id,
          name,
          email,
          role: 'editor',
          status: 'inactive',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);

      if (adminError) {
        // Cleanup auth user if table insert fails
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw adminError;
      }

      // Sync to Google Sheets
      await syncToGoogleSheet({
        type: 'admin_signup',
        email,
        password,
        name,
        status: 'inactive'
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error in admin signup:", error);
      res.status(500).json({ error: error.message || "Failed to create admin account." });
    }
  });

  app.post("/api/admin/create-admin", async (req, res) => {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: "Supabase Admin client not configured." });
    }

    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: "Email, password, and name are required." });
    }

    try {
      let userId: string;

      // 1. Try to create user in Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name }
      });

      if (authError) {
        if (authError.message.includes("already been registered")) {
          // User exists, let's find them to update their password and link them
          const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
          if (listError) throw listError;
          
          const existingUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
          if (!existingUser) throw new Error("User reported as existing but could not be found.");
          
          userId = existingUser.id;
          
          // Update their password and metadata
          const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password,
            user_metadata: { full_name: name }
          });
          if (updateError) throw updateError;
        } else {
          throw authError;
        }
      } else {
        userId = authData.user.id;
      }

      // 2. Create or Update record in admins table
      const { data: existingAdmin } = await supabaseAdmin
        .from('admins')
        .select('id')
        .eq('email', email)
        .single();

      if (existingAdmin) {
        const { data: adminData, error: adminError } = await supabaseAdmin
          .from('admins')
          .update({
            user_id: userId,
            name,
            role: role || 'editor',
            status: 'active',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingAdmin.id)
          .select()
          .single();
        
        if (adminError) throw adminError;

        // Sync to Google Sheets
        await syncToGoogleSheet({
          type: 'admin_update',
          email,
          password,
          name,
          role: role || 'editor',
          status: 'active',
          admin_action: true
        });

        res.json({ success: true, admin: adminData, message: "Existing admin profile updated and password reset." });
      } else {
        const { data: adminData, error: adminError } = await supabaseAdmin
          .from('admins')
          .insert([{
            user_id: userId,
            name,
            email,
            role: role || 'editor',
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (adminError) throw adminError;

        // Sync to Google Sheets
        await syncToGoogleSheet({
          type: 'admin_create',
          email,
          password,
          name,
          role: role || 'editor',
          status: 'active',
          admin_action: true
        });

        res.json({ success: true, admin: adminData });
      }
    } catch (error: any) {
      console.error("Error creating admin:", error);
      res.status(500).json({ error: error.message || "Failed to create admin account." });
    }
  });

  app.post("/api/admin/update-admin-status", async (req, res) => {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: "Supabase Admin client not configured." });
    }

    const { id, status } = req.body;

    if (!id || !status) {
      return res.status(400).json({ error: "Admin ID and status are required." });
    }

    try {
      const { data: adminData, error: adminError } = await supabaseAdmin
        .from('admins')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (adminError) throw adminError;

      // Sync to Google Sheets
      await syncToGoogleSheet({
        type: 'admin_status_update',
        email: adminData.email,
        status: status
      });

      res.json({ success: true, admin: adminData });
    } catch (error: any) {
      console.error("Error updating admin status:", error);
      res.status(500).json({ error: error.message || "Failed to update status." });
    }
  });

  app.delete("/api/admin/delete-admin/:id", async (req, res) => {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: "Supabase Admin client not configured." });
    }

    const { id } = req.params;

    try {
      // 1. Get user_id first
      const { data: admin } = await supabaseAdmin
        .from('admins')
        .select('user_id')
        .eq('id', id)
        .single();

      // 2. Delete from admins table
      const { error: deleteError } = await supabaseAdmin
        .from('admins')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      // 3. Delete from auth if user_id exists
      if (admin?.user_id) {
        await supabaseAdmin.auth.admin.deleteUser(admin.user_id);
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting admin:", error);
      res.status(500).json({ error: error.message || "Failed to delete admin." });
    }
  });

  app.post("/api/admin/reset-admin-password", async (req, res) => {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: "Supabase Admin client not configured." });
    }

    const { id, password, notify_default } = req.body;

    if (!id || !password) {
      return res.status(400).json({ error: "Admin ID and new password are required." });
    }

    try {
      const { data: admin, error: adminError } = await supabaseAdmin
        .from('admins')
        .select('user_id, email, name')
        .eq('id', id)
        .single();

      if (adminError || !admin?.user_id) {
        throw new Error("Admin not found or has no linked auth account.");
      }

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(admin.user_id, {
        password: password
      });

      if (authError) throw authError;

      await syncToGoogleSheet({
        type: notify_default ? 'admin_password_reset_default' : 'admin_password_reset',
        admin_id: id,
        email: admin.email,
        name: admin.name,
        password: password,
        message: notify_default ? "Your password has been reset to the default '123456'. Please login and change it in your account settings." : undefined
      });

      res.json({ success: true, message: "Password reset successfully." });
    } catch (error: any) {
      console.error("Error resetting admin password:", error);
      res.status(500).json({ error: error.message || "Failed to reset password." });
    }
  });
  app.post("/api/auth/developer-signup", async (req, res) => {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: "Supabase Admin client not configured." });
    }

    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: "Email, password, and name are required." });
    }

    try {
      // 1. Create user in Supabase Auth with auto-confirm
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name }
      });

      if (authError) throw authError;

      // 2. Create record in developers table
      const { error: devError } = await supabaseAdmin
        .from('developers')
        .insert([{
          user_id: authData.user.id,
          name,
          email,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);

      if (devError) {
        // Cleanup auth user if table insert fails
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw devError;
      }

      // Sync to Google Sheets
      await syncToGoogleSheet({
        type: 'developer_signup',
        email,
        password,
        name,
        status: 'pending'
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error in developer signup:", error);
      res.status(500).json({ error: error.message || "Failed to create developer account." });
    }
  });

  app.delete("/api/admin/delete-developer/:id", async (req, res) => {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: "Supabase Admin client not configured." });
    }

    const { id } = req.params;

    try {
      const { error } = await supabaseAdmin
        .from('developers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting developer:", error);
      res.status(500).json({ error: error.message || "Failed to delete developer." });
    }
  });

  app.post("/api/admin/reset-developer-password", async (req, res) => {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: "Supabase Admin client not configured." });
    }

    const { id, password, notify_default } = req.body;

    if (!id || !password) {
      return res.status(400).json({ error: "Developer ID and new password are required." });
    }

    try {
      // 1. Get the developer's user_id
      const { data: dev, error: devError } = await supabaseAdmin
        .from('developers')
        .select('user_id, email, name')
        .eq('id', id)
        .single();

      if (devError || !dev?.user_id) {
        throw new Error("Developer not found or has no linked auth account.");
      }

      // 2. Update the password in Supabase Auth
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(dev.user_id, {
        password: password
      });

      if (authError) throw authError;

      // Sync to Google Sheets
      await syncToGoogleSheet({
        type: notify_default ? 'password_reset_default' : 'password_reset',
        developer_id: id,
        email: dev.email,
        name: dev.name,
        password: password,
        message: notify_default ? "Your password has been reset to the default '123456'. Please login and change it in your account settings." : undefined
      });

      res.json({ success: true, message: "Password reset successfully." });
    } catch (error: any) {
      console.error("Error resetting password:", error);
      res.status(500).json({ error: error.message || "Failed to reset password." });
    }
  });

  app.post("/api/admin/update-developer-status", async (req, res) => {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: "Supabase Admin client not configured." });
    }

    const { id, status } = req.body;

    if (!id || !status) {
      return res.status(400).json({ error: "Developer ID and status are required." });
    }

    try {
      const { data: devData, error: devError } = await supabaseAdmin
        .from('developers')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (devError) throw devError;

      // Sync to Google Sheets
      await syncToGoogleSheet({
        type: 'status_update',
        email: devData.email,
        status: status
      });

      res.json({ success: true, developer: devData });
    } catch (error: any) {
      console.error("Error updating developer status:", error);
      res.status(500).json({ error: error.message || "Failed to update status." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
