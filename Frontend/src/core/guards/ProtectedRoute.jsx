import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@core/context/AuthContext';
import { AppShellSkeleton } from '@food/components/ui/loading-skeletons';

const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return <AppShellSkeleton />;
    }

    if (!isAuthenticated) {
        if (location.pathname.startsWith('/admin')) {
            return <Navigate to="/admin/login" state={{ from: location }} replace />;
        }
        if (location.pathname.startsWith('/seller')) {
            return <Navigate to="/seller/auth" state={{ from: location }} replace />;
        }
        if (location.pathname.startsWith('/delivery')) {
            return <Navigate to="/delivery/auth" state={{ from: location }} replace />;
        }
        return <Navigate to="/user/auth/login" state={{ from: location }} replace />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;
