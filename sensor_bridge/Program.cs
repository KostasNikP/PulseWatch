
using System.Text.Json;
using LibreHardwareMonitor.Hardware;


// PULSEWATCH SENSOR BRIDGE

// Default: one snapshot
// --stream: continuous snapshots every 2 seconds

bool streamMode = args.Contains(
    "--stream",
    StringComparer.OrdinalIgnoreCase
);

var computer = new Computer
{
    IsCpuEnabled = true,
    IsGpuEnabled = true,
    IsMemoryEnabled = true,
    IsMotherboardEnabled = true,
    IsStorageEnabled = true,
    IsNetworkEnabled = true,
    IsControllerEnabled = true,
    IsPowerMonitorEnabled = true
};

var jsonOptions = new JsonSerializerOptions
{
    WriteIndented = !streamMode
};

bool opened = false;

try
{
    computer.Open();
    opened = true;

    while (true)
    {
        var hardware = computer.Hardware
            .Select(ReadHardware)
            .ToList();

        var result = new
        {
            timestamp = DateTimeOffset.UtcNow
                .ToUnixTimeSeconds(),

            hardware = hardware
        };

        Console.WriteLine(
            JsonSerializer.Serialize(
                result,
                jsonOptions
            )
        );

        Console.Out.Flush();

        if (!streamMode)
        {
            break;
        }

        Thread.Sleep(2000);
    }
}
catch (Exception ex)
{
    Console.Error.WriteLine(
        $"Sensor Bridge Error: {ex.Message}"
    );

    Environment.ExitCode = 1;
}
finally
{
    if (opened)
    {
        computer.Close();
    }
}


// READ HARDWARE AND SENSORS

static object ReadHardware(IHardware hardware)
{
    string? updateError = null;

    try
    {
        hardware.Update();
    }
    catch (Exception ex)
    {
        updateError = ex.Message;
    }

    var sensors = hardware.Sensors.Select(sensor =>
    {
        float? value = sensor.Value;

        if (
            value.HasValue &&
            !float.IsFinite(value.Value)
        )
        {
            value = null;
        }

        return new
        {
            id = sensor.Identifier.ToString(),
            name = sensor.Name,
            type = sensor.SensorType.ToString(),
            value = value
        };
    }).ToList();

    var children = hardware.SubHardware
        .Select(ReadHardware)
        .ToList();

    return new
    {
        id = hardware.Identifier.ToString(),
        name = hardware.Name,
        category = hardware.HardwareType.ToString(),
        sensors = sensors,
        children = children,
        error = updateError
    };
}
