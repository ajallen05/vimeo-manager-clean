import { useState, useEffect, useRef } from "react";

export function TestInput() {
  const [value, setValue] = useState("");
  const [events, setEvents] = useState<
    Array<{ type: string; data: any; timestamp: string }>
  >([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const renderCount = useRef(0);

  // Log render count
  renderCount.current += 1;
  console.log(`Render #${renderCount.current}`, { value });

  const logEvent = (type: string, data: any = {}) => {
    const event = { type, data, timestamp: new Date().toISOString() };
    console.log(`[EVENT] ${type}`, event);
    setEvents((prev) => [event, ...prev].slice(0, 20)); // Keep last 20 events
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: string
  ) => {
    const newValue = e.target.value;
    logEvent(`[${type}] onChange`, {
      newValue,
      eventType: e.type,
      inputValue: e.target.value,
      currentState: value,
      isComposing:
        "isComposing" in e.nativeEvent
          ? (e.nativeEvent as InputEvent).isComposing
          : false,
      inputElementValue: (e.target as HTMLInputElement).value,
      inputElement: e.target,
    });

    setValue((prev) => {
      logEvent(`[${type}] setValue`, { previous: prev, newValue });
      return newValue;
    });
  };

  // Log input element reference
  useEffect(() => {
    if (inputRef.current) {
      logEvent("Input element mounted", {
        value: inputRef.current.value,
        defaultValue: inputRef.current.defaultValue,
        attributes: Object.fromEntries(
          Array.from(inputRef.current.attributes).map((attr) => [
            attr.name,
            attr.value,
          ])
        ),
        computedStyle: window.getComputedStyle(inputRef.current),
      });
    }
  }, []);

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-4">Test Input</h2>
      <div className="space-y-6">
        <div className="p-4 border rounded-lg bg-background">
          <h3 className="font-medium mb-2">Debug Info</h3>
          <div className="text-sm space-y-1">
            <p>Component rendered: {renderCount.current} times</p>
            <p>
              Current value:{" "}
              <code className="bg-muted px-1 rounded">
                {value || "(empty)"}
              </code>
            </p>
            <p>Input ref: {inputRef.current ? "Attached" : "Not attached"}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Native Input
            </label>
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => handleChange(e, "native")}
              onKeyDown={(e) =>
                logEvent("Key down", { key: e.key, code: e.code })
              }
              onKeyUp={(e) => logEvent("Key up", { key: e.key, code: e.code })}
              onCompositionStart={() => logEvent("Composition start")}
              onCompositionUpdate={(e) =>
                logEvent("Composition update", { data: e.data })
              }
              onCompositionEnd={() => logEvent("Composition end")}
              onFocus={() => logEvent("Input focused")}
              onBlur={() => logEvent("Input blurred")}
              onInput={(e) =>
                logEvent("Input event", {
                  value: (e.target as HTMLInputElement).value,
                })
              }
              className="w-full p-2 border rounded font-mono text-sm"
              placeholder="Type here..."
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-testid="test-input-native"
            />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>
                Value: <span className="font-mono">{value || "(empty)"}</span>
              </span>
              <span>Length: {value.length}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              ShadCN Input
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => {
                console.log("ShadCN input changed:", e.target.value);
                setValue(e.target.value);
              }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Type here..."
            />
            <p className="text-sm text-muted-foreground mt-1">
              Value: {value || "(empty)"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
