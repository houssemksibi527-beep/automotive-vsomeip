// SOME/IP identifiers shared by the LIDAR service and the STEERING client.
// Values match the COVESA/vsomeip sample so the Wireshark SOME/IP dissector
// and the vsomeip tutorials line up.
#pragma once

#define SAMPLE_SERVICE_ID       0x1234
#define SAMPLE_INSTANCE_ID      0x5678
#define SAMPLE_METHOD_ID        0x0421

#define SAMPLE_EVENT_ID         0x8778   // LIDAR obstacle-distance event
#define SAMPLE_GET_METHOD_ID    0x0001
#define SAMPLE_SET_METHOD_ID    0x0002

#define SAMPLE_EVENTGROUP_ID    0x4465
