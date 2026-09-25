import { useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

/** GF5 minimum: trip detail scaffold — status + booking summary placeholders. */
export default function TravelTripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View style={{ padding: 16, gap: 8 }}>
      <Text style={{ fontSize: 22, fontWeight: "600" }}>Trip</Text>
      <Text>ID: {id}</Text>
      <Text>Request status, booking confirmation, and fund/card summaries are available on web for GF5.</Text>
      <Text>Native gaps: full search/select/reprice/book UX, document capture, offline itinerary.</Text>
    </View>
  );
}
