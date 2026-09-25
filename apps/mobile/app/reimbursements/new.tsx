import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

/**
 * Minimal GF4 employee reimbursement create (scaffold).
 * Full native receipt camera + offline queue remain deferred — web + API are the validated path.
 */
export default function Screen() {
  const [type, setType] = useState<"STANDARD" | "MILEAGE" | "PER_DIEM">("STANDARD");
  const [memo, setMemo] = useState("");
  const [amount, setAmount] = useState("");
  const [distance, setDistance] = useState("");
  const [days, setDays] = useState("");
  const [message, setMessage] = useState("Use company web for full receipt upload + payout status.");

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "600" }}>New reimbursement</Text>
      <Text>Type: {type}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {(["STANDARD", "MILEAGE", "PER_DIEM"] as const).map((value) => (
          <Pressable key={value} onPress={() => setType(value)}>
            <Text>{value}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput placeholder="Business purpose" value={memo} onChangeText={setMemo} />
      {type === "STANDARD" && <TextInput placeholder="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />}
      {type === "MILEAGE" && <TextInput placeholder="Miles" value={distance} onChangeText={setDistance} keyboardType="decimal-pad" />}
      {type === "PER_DIEM" && <TextInput placeholder="Days" value={days} onChangeText={setDays} keyboardType="number-pad" />}
      <Pressable onPress={() => setMessage("Draft fields captured locally — submit via API/web for GF4-validated path.")}>
        <Text>Save draft locally</Text>
      </Pressable>
      <Text>{message}</Text>
    </View>
  );
}
