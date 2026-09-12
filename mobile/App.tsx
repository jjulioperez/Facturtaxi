import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { ProfileProvider, useProfile } from "./src/context/ProfileContext";
import { supabase } from "./src/lib/supabaseClient";
import LoginScreen from "./src/screens/LoginScreen";
import PendingApprovalScreen from "./src/screens/PendingApprovalScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import NewInvoiceScreen from "./src/screens/NewInvoiceScreen";
import InvoiceHistoryScreen from "./src/screens/InvoiceHistoryScreen";
import ClientsScreen from "./src/screens/ClientsScreen";
import TemplateScreen from "./src/screens/TemplateScreen";
import Spinner from "./src/components/Spinner";
import { colors } from "./src/theme";

const Tab = createBottomTabNavigator();

function SignOutButton() {
  return (
    <TouchableOpacity onPress={() => supabase.auth.signOut()} style={styles.signOutButton}>
      <Text style={styles.signOutText}>Salir</Text>
    </TouchableOpacity>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerRight: () => <SignOutButton />,
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { color: colors.text },
        tabBarActiveTintColor: colors.brand,
      }}
    >
      <Tab.Screen
        name="Inicio"
        component={DashboardScreen}
        options={{
          title: "Inicio",
          tabBarLabel: "Inicio",
          tabBarIcon: ({ color, size }) => <Text style={{ fontSize: size, color }}>🏠</Text>,
        }}
      />
      <Tab.Screen
        name="NuevaFactura"
        component={NewInvoiceScreen}
        options={{
          title: "Nueva factura",
          tabBarLabel: "Nueva",
          tabBarIcon: ({ color, size }) => <Text style={{ fontSize: size, color }}>🧾</Text>,
        }}
      />
      <Tab.Screen
        name="Historial"
        component={InvoiceHistoryScreen}
        options={{
          title: "Historial",
          tabBarLabel: "Historial",
          tabBarIcon: ({ color, size }) => <Text style={{ fontSize: size, color }}>📂</Text>,
        }}
      />
      <Tab.Screen
        name="Clientes"
        component={ClientsScreen}
        options={{
          title: "Clientes",
          tabBarLabel: "Clientes",
          tabBarIcon: ({ color, size }) => <Text style={{ fontSize: size, color }}>👤</Text>,
        }}
      />
      <Tab.Screen
        name="Plantilla"
        component={TemplateScreen}
        options={{
          title: "Plantilla",
          tabBarLabel: "Plantilla",
          tabBarIcon: ({ color, size }) => <Text style={{ fontSize: size, color }}>🎨</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();

  if (authLoading) return <Spinner label="Cargando..." />;
  if (!user) return <LoginScreen />;
  if (profileLoading) return <Spinner label="Cargando..." />;
  if (profile && !profile.approved) return <PendingApprovalScreen />;

  return <MainTabs />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ProfileProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </ProfileProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  signOutButton: { paddingHorizontal: 16 },
  signOutText: { color: colors.textMuted, fontWeight: "600" },
});
