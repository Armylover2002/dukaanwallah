import { AdminRole } from '../../../../core/admin/role.model.js';
import { sendResponse, sendError } from '../../../../utils/response.js';

/**
 * Get all roles
 */
export const getRoles = async (req, res) => {
    try {
        const roles = await AdminRole.find().sort({ createdAt: -1 });
        return sendResponse(res, 200, roles);
    } catch (error) {
        return sendError(res, 500, error.message);
    }
};

/**
 * Get single role
 */
export const getRoleById = async (req, res) => {
    try {
        const role = await AdminRole.findById(req.params.id);
        if (!role) return sendError(res, 404, 'Role not found');
        return sendResponse(res, 200, role);
    } catch (error) {
        return sendError(res, 500, error.message);
    }
};

/**
 * Create a new role
 */
export const createRole = async (req, res) => {
    try {
        const { roleName, description, permissions } = req.body;

        // Check if role already exists
        const existingRole = await AdminRole.findOne({ roleName: { $regex: new RegExp(`^${roleName}$`, 'i') } });
        if (existingRole) {
            return sendError(res, 400, 'Role name already exists');
        }

        const newRole = new AdminRole({
            roleName,
            description,
            permissions,
            createdBy: req.user?._id
        });

        await newRole.save();
        return sendResponse(res, 201, newRole, 'Role created successfully');
    } catch (error) {
        return sendError(res, 500, error.message);
    }
};

/**
 * Update an existing role
 */
export const updateRole = async (req, res) => {
    try {
        const { roleName, description, permissions, status } = req.body;
        const roleId = req.params.id;

        const role = await AdminRole.findById(roleId);
        if (!role) return sendError(res, 404, 'Role not found');

        // Prevent disabling default role
        if (role.isDefault && status === 'inactive') {
            return sendError(res, 400, 'Cannot disable system default role');
        }

        // Check name uniqueness if changed
        if (roleName && roleName !== role.roleName) {
            const existingRole = await AdminRole.findOne({ 
                roleName: { $regex: new RegExp(`^${roleName}$`, 'i') },
                _id: { $ne: roleId }
            });
            if (existingRole) {
                return sendError(res, 400, 'Role name already exists');
            }
        }

        role.roleName = roleName || role.roleName;
        role.description = description !== undefined ? description : role.description;
        role.permissions = permissions || role.permissions;
        role.status = status || role.status;

        await role.save();
        return sendResponse(res, 200, role, 'Role updated successfully');
    } catch (error) {
        return sendError(res, 500, error.message);
    }
};

/**
 * Toggle role status
 */
export const toggleRoleStatus = async (req, res) => {
    try {
        const role = await AdminRole.findById(req.params.id);
        if (!role) return sendError(res, 404, 'Role not found');

        if (role.isDefault && role.status === 'active') {
            return sendError(res, 400, 'Cannot disable system default role');
        }

        role.status = role.status === 'active' ? 'inactive' : 'active';
        await role.save();

        return sendResponse(res, 200, role, `Role ${role.status === 'active' ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
        return sendError(res, 500, error.message);
    }
};
