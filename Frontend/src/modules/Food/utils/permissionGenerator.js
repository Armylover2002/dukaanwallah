import { adminSidebarMenu } from './adminSidebarMenu.js';
import { quickAdminSidebarMenu } from './quickAdminSidebarMenu.js';
import { commonAdminSidebarMenu } from './commonAdminSidebarMenu.js';

/**
 * Generates a hierarchical tree of permissions from sidebar configurations.
 * Used by the Role Creation UI to build the checkbox tree.
 * 
 * @param {Object} enabledModules - Map of module status: { food: true, quickCommerce: false }
 */
export function generatePermissionTree(enabledModules = null) {
  const configs = [
    { root: 'food', data: adminSidebarMenu, moduleKey: 'food' },
    { root: 'quick', data: quickAdminSidebarMenu, moduleKey: 'quickCommerce' },
    { root: 'global', data: commonAdminSidebarMenu, moduleKey: null } // Always show global
  ];

  const tree = [];

  configs.forEach(({ root, data, moduleKey }) => {
    // If modules are provided, filter out disabled modules
    if (enabledModules && moduleKey && enabledModules[moduleKey] === false) {
      return;
    }

    const moduleNode = {
      label: root.charAt(0).toUpperCase() + root.slice(1),
      permissionKey: root,
      children: []
    };

    data.forEach(item => {
      const node = processNode(item, root);
      if (node) moduleNode.children.push(node);
    });

    if (moduleNode.children.length > 0) {
      tree.push(moduleNode);
    }
  });

  return tree;
}

function processNode(item, parentKey) {
  // If no permissionKey, we can't generate a permission for it (Super Admin only policy)
  if (!item.permissionKey) return null;

  const currentKey = `${parentKey}.${item.permissionKey}`;
  
  const node = {
    label: item.label,
    permissionKey: currentKey,
    type: item.type,
    children: []
  };

  // Process sections
  if (item.type === 'section' && item.items) {
    item.items.forEach(child => {
      const childNode = processNode(child, currentKey);
      if (childNode) node.children.push(childNode);
    });
  }

  // Process expandable menus
  if (item.type === 'expandable' && item.subItems) {
    item.subItems.forEach(child => {
      const childNode = processNode(child, currentKey);
      if (childNode) node.children.push(childNode);
    });
  }

  return node;
}
