import { Tabs } from "expo-router";
import {
    MapPin,
    Map,
    Building2,
    Trees,
    Home,
    Blocks,
    Compass,
    Shield,
    Warehouse,
    Church,
    Waves,
    Zap,
    Locate,
    Mountain,
  } from "lucide-react-native";
  
  export default function TabLayout() {
    return (
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: "#000000",
            borderTopWidth: 0.5,
            borderTopColor: "rgba(255, 255, 255, 0.1)",
            paddingTop: 8,
            paddingBottom: 4,
          },
          tabBarActiveTintColor: "#FFFFFF",
          tabBarInactiveTintColor: "rgba(255, 255, 255, 0.4)",
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: "500",
            marginTop: 4,
          },
          tabBarIconStyle: {
            marginTop: 4,
          },
        }}
      >
        <Tabs.Screen
          name="central"
          options={{
            title: "Town Centre",
            tabBarIcon: ({ color }) => <Building2 color={color} size={20} />,
          }}
        />
        <Tabs.Screen
          name="batchley"
          options={{
            title: "Batchley",
            tabBarIcon: ({ color }) => <Home color={color} size={20} />,
          }}
        />
        <Tabs.Screen
          name="winyates"
          options={{
            title: "Winyates",
            tabBarIcon: ({ color }) => <Warehouse color={color} size={20} />,
          }}
        />
        <Tabs.Screen
          name="lodge"
          options={{
            title: "Lodge Park",
            tabBarIcon: ({ color }) => <MapPin color={color} size={20} />,
          }}
        />
        <Tabs.Screen
          name="church"
          options={{
            title: "Church Hill",
            tabBarIcon: ({ color }) => <Church color={color} size={20} />,
          }}
        />
        <Tabs.Screen
          name="woodrow"
          options={{
            title: "Woodrow",
            tabBarIcon: ({ color }) => <Blocks color={color} size={20} />,
          }}
        />
        <Tabs.Screen
          name="matchborough"
          options={{
            title: "Matchborough",
            tabBarIcon: ({ color }) => <Zap color={color} size={20} />,
          }}
        />
        <Tabs.Screen
          name="greenlands"
          options={{
            title: "Greenlands",
            tabBarIcon: ({ color }) => <Map color={color} size={20} />,
          }}
        />
        <Tabs.Screen
          name="lakeside"
          options={{
            title: "Lakeside",
            tabBarIcon: ({ color }) => <Waves color={color} size={20} />,
          }}
        />
        <Tabs.Screen
          name="headless"
          options={{
            title: "Headless Cross",
            tabBarIcon: ({ color }) => <Locate color={color} size={20} />,
          }}
        />
        <Tabs.Screen
          name="oakenshaw"
          options={{
            title: "Oakenshaw",
            tabBarIcon: ({ color }) => <Compass color={color} size={20} />,
          }}
        />
        <Tabs.Screen
          name="webheath"
          options={{
            title: "Webheath",
            tabBarIcon: ({ color }) => <Shield color={color} size={20} />,
          }}
        />
        <Tabs.Screen
          name="astwood"
          options={{
            title: "Astwood Bank",
            tabBarIcon: ({ color }) => <Trees color={color} size={20} />,
          }}
        />
        <Tabs.Screen
          name="feckenham"
          options={{
            title: "Feckenham",
            tabBarIcon: ({ color }) => <Mountain color={color} size={20} />,
          }}
        />
        <Tabs.Screen
          name="north"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="post"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            href: null,
          }}
        />
      </Tabs>

  );
}
