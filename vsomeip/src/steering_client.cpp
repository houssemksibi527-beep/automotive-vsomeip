// STEERING ("volant") ECU — a SOME/IP client that subscribes to the LIDAR
// obstacle-distance event and reacts (one-way ADAS flow). Adapted from
// COVESA/vsomeip examples/subscribe-sample.cpp (MPL-2.0, BMW AG). The vsomeip
// API usage is kept identical; only on_message() is changed to decode the
// distance and print a driver-assist reaction.

#ifndef VSOMEIP_ENABLE_SIGNAL_HANDLING
#include <csignal>
#if defined(__linux__) || defined(__QNX__)
#include <pthread.h>
#endif
#endif
#include <chrono>
#include <condition_variable>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <thread>

#include <vsomeip/vsomeip.hpp>

#include "sample-ids.hpp"

class steering_client {
public:
    steering_client(bool _use_tcp) : app_(vsomeip::runtime::get()->create_application()), use_tcp_(_use_tcp) { }

    bool init() {
        if (!app_->init()) {
            std::cerr << "STEERING: couldn't initialize application" << std::endl;
            return false;
        }
        std::cout << "STEERING: settings [protocol=" << (use_tcp_ ? "TCP" : "UDP") << "]" << std::endl;

        app_->register_state_handler(std::bind(&steering_client::on_state, this, std::placeholders::_1));

        app_->register_message_handler(vsomeip::ANY_SERVICE, SAMPLE_INSTANCE_ID, vsomeip::ANY_METHOD,
                                       std::bind(&steering_client::on_message, this, std::placeholders::_1));

        app_->register_availability_handler(
                SAMPLE_SERVICE_ID, SAMPLE_INSTANCE_ID,
                std::bind(&steering_client::on_availability, this, std::placeholders::_1, std::placeholders::_2, std::placeholders::_3));

        std::set<vsomeip::eventgroup_t> its_groups;
        its_groups.insert(SAMPLE_EVENTGROUP_ID);
        app_->request_event(SAMPLE_SERVICE_ID, SAMPLE_INSTANCE_ID, SAMPLE_EVENT_ID, its_groups, vsomeip::event_type_e::ET_FIELD);
        app_->subscribe(SAMPLE_SERVICE_ID, SAMPLE_INSTANCE_ID, SAMPLE_EVENTGROUP_ID);

        return true;
    }

    void start() { app_->start(); }

    void stop() {
        app_->clear_all_handler();
        app_->unsubscribe(SAMPLE_SERVICE_ID, SAMPLE_INSTANCE_ID, SAMPLE_EVENTGROUP_ID);
        app_->release_event(SAMPLE_SERVICE_ID, SAMPLE_INSTANCE_ID, SAMPLE_EVENT_ID);
        app_->release_service(SAMPLE_SERVICE_ID, SAMPLE_INSTANCE_ID);
        app_->stop();
    }

    void on_state(vsomeip::state_type_e _state) {
        if (_state == vsomeip::state_type_e::ST_REGISTERED) {
            app_->request_service(SAMPLE_SERVICE_ID, SAMPLE_INSTANCE_ID);
        }
    }

    void on_availability(vsomeip::service_t _service, vsomeip::instance_t _instance, bool _is_available) {
        std::cout << "STEERING: LIDAR service [" << std::hex << std::setfill('0') << std::setw(4) << _service << "."
                  << std::setw(4) << _instance << "] is " << (_is_available ? "available." : "NOT available.") << std::endl;
    }

    // Decode the 2-byte big-endian obstacle distance (cm) and react.
    void on_message(const std::shared_ptr<vsomeip::message>& _response) {
        std::shared_ptr<vsomeip::payload> its_payload = _response->get_payload();
        const uint32_t len = its_payload->get_length();

        std::stringstream its_message;
        its_message << "STEERING: event [" << std::hex << std::setfill('0') << std::setw(4) << _response->get_service()
                    << "." << std::setw(4) << _response->get_instance() << "." << std::setw(4) << _response->get_method()
                    << "] len=" << std::dec << len;

        if (len >= 2) {
            const uint16_t distance_cm = static_cast<uint16_t>((its_payload->get_data()[0] << 8) | its_payload->get_data()[1]);
            const double m = distance_cm / 100.0;
            its_message << "  obstacle=" << std::fixed << std::setprecision(2) << m << " m  -> ";
            if (m < 1.0)
                its_message << "REACT: hard brake / evasive steer";
            else if (m < 2.5)
                its_message << "REACT: reduce speed, prime steering";
            else
                its_message << "REACT: clear, hold course";
        }
        std::cout << its_message.str() << std::endl;
    }

private:
    std::shared_ptr<vsomeip::application> app_;
    bool use_tcp_;
};

int main(int argc, char** argv) {
    bool use_tcp = false;

    std::string tcp_enable("--tcp");
    std::string udp_enable("--udp");

    int i = 1;
    while (i < argc) {
        if (tcp_enable == argv[i]) {
            use_tcp = true;
        } else if (udp_enable == argv[i]) {
            use_tcp = false;
        }
        i++;
    }

#ifndef VSOMEIP_ENABLE_SIGNAL_HANDLING
#if defined(__linux__) || defined(__QNX__)
    sigset_t its_signals;
    sigemptyset(&its_signals);
    sigaddset(&its_signals, SIGINT);
    sigaddset(&its_signals, SIGTERM);
    pthread_sigmask(SIG_BLOCK, &its_signals, nullptr);
#endif
#endif

    steering_client its_sample(use_tcp);
    if (its_sample.init()) {
#ifndef VSOMEIP_ENABLE_SIGNAL_HANDLING
#if defined(__linux__) || defined(__QNX__)
        std::thread signal_watcher([&its_sample]() {
            sigset_t its_wait_set;
            sigemptyset(&its_wait_set);
            sigaddset(&its_wait_set, SIGINT);
            sigaddset(&its_wait_set, SIGTERM);

            int its_signal = 0;
            while (sigwait(&its_wait_set, &its_signal) == 0) {
                if (its_signal == SIGINT || its_signal == SIGTERM) {
                    its_sample.stop();
                    return;
                }
            }
        });
#endif
#endif
        its_sample.start();
#ifdef VSOMEIP_ENABLE_SIGNAL_HANDLING
        its_sample.stop();
#endif
#ifndef VSOMEIP_ENABLE_SIGNAL_HANDLING
#if defined(__linux__) || defined(__QNX__)
        if (signal_watcher.joinable()) {
            signal_watcher.join();
        }
#endif
#endif
        return 0;
    } else {
        return 1;
    }
}
