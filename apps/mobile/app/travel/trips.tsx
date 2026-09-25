import { Link } from "expo-router";
import { Text, View } from "react-native";

/** GF5 minimum: trip list scaffold. Full native booking UX deferred. */
export default function TravelTripsScreen() {
  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "600" }}>Trips</Text>
      <Text>View trip status and booking summaries. Create and search from web for GF5.</Text>
      <Link href="/travel/search">Search (limited)</Link>
    </View>
  );
}
