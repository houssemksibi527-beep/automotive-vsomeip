// LIDAR ECU — a SOME/IP service that periodically publishes an obstacle-distance
// event to any subscriber. Adapted from COVESA/vsomeip examples/notify-sample.cpp
// (MPL-2.0, BMW AG). Only the class name, payload semantics and logging differ;
// the vsomeip API usage is kept identical so it builds against upstream.

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
#include <mutex>

#include <vsomeip/vsomeip.hpp>

#include "sample-ids.hpp"

class lidar_service {
public:
    lidar_service(uint32_t _cycle) :
        app_(vsomeip::runtime::get()->create_application()), is_registered_(false), cycle_(_cycle), blocked_(false),
        running_(true), is_offered_(false), distance_cm_(500),
        offer_thread_(std::bind(&lidar_service::run, this)), notify_thread_(std::bind(&lidar_service::notify, this)) {
    }

    bool init() {
        std::scoped_lock its_lock(mutex_);

        if (!app_->init()) {
            std::cerr << "LIDAR: couldn't initialize application" << std::endl;
            return false;
        }
        app_->register_state_handler(std::bind(&lidar_service::on_state, this, std::placeholders::_1));

        app_->register_message_handler(SAMPLE_SERVICE_ID, SAMPLE_INSTANCE_ID, SAMPLE_GET_METHOD_ID,
                                       std::bind(&lidar_service::on_get, this, std::placeholders::_1));

        app_->register_message_handler(SAMPLE_SERVICE_ID, SAMPLE_INSTANCE_ID, SAMPLE_SET_METHOD_ID,
                                       std::bind(&lidar_service::on_set, this, std::placeholders::_1));

        std::set<vsomeip::eventgroup_t> its_groups;
        its_groups.insert(SAMPLE_EVENTGROUP_ID);
        app_->offer_event(SAMPLE_SERVICE_ID, SAMPLE_INSTANCE_ID, SAMPLE_EVENT_ID, its_groups, vsomeip::event_type_e::ET_FIELD,
                          std::chrono::milliseconds::zero(), false, true, nullptr, vsomeip::reliability_type_e::RT_UNKNOWN);
        {
            std::scoped_lock its_pl_lock(payload_mutex_);
            payload_ = vsomeip::runtime::get()->create_payload();
        }

        blocked_ = true;
        condition_.notify_one();
        return true;
    }

    void start() { app_->start(); }

    void stop() {
        running_ = false;
        blocked_ = true;
        condition_.notify_one();
        notify_condition_.notify_one();
        app_->clear_all_handler();
        stop_offer();
        if (std::this_thread::get_id() != offer_thread_.get_id()) {
            if (offer_thread_.joinable()) {
                offer_thread_.join();
            }
        } else {
            offer_thread_.detach();
        }
        if (std::this_thread::get_id() != notify_thread_.get_id()) {
            if (notify_thread_.joinable()) {
                notify_thread_.join();
            }
        } else {
            notify_thread_.detach();
        }
        app_->stop();
    }

    void offer() {
        std::scoped_lock its_lock(notify_mutex_);
        app_->offer_service(SAMPLE_SERVICE_ID, SAMPLE_INSTANCE_ID);
        is_offered_ = true;
        notify_condition_.notify_one();
    }

    void stop_offer() {
        app_->stop_offer_service(SAMPLE_SERVICE_ID, SAMPLE_INSTANCE_ID);
        is_offered_ = false;
    }

    void on_state(vsomeip::state_type_e _state) {
        std::cout << "LIDAR: application " << app_->get_name() << " is "
                  << (_state == vsomeip::state_type_e::ST_REGISTERED ? "registered." : "deregistered.") << std::endl;

        if (_state == vsomeip::state_type_e::ST_REGISTERED) {
            if (!is_registered_) {
                is_registered_ = true;
            }
        } else {
            is_registered_ = false;
        }
    }

    // Optional request/response accessors kept from the sample (unused in the
    // one-way ADAS flow, harmless to leave registered).
    void on_get(const std::shared_ptr<vsomeip::message>& _message) {
        std::shared_ptr<vsomeip::message> its_response = vsomeip::runtime::get()->create_response(_message);
        {
            std::scoped_lock its_lock(payload_mutex_);
            its_response->set_payload(payload_);
        }
        app_->send(its_response);
    }

    void on_set(const std::shared_ptr<vsomeip::message>& _message) {
        std::shared_ptr<vsomeip::message> its_response = vsomeip::runtime::get()->create_response(_message);
        {
            std::scoped_lock its_lock(payload_mutex_);
            payload_ = _message->get_payload();
            its_response->set_payload(payload_);
        }
        app_->send(its_response);
        app_->notify(SAMPLE_SERVICE_ID, SAMPLE_INSTANCE_ID, SAMPLE_EVENT_ID, payload_);
    }

    // Offer the service once and keep it offered for the whole run (SD sends the
    // cyclic offers). A steady offer makes the live UI clean instead of blinking
    // available/unavailable on a duty cycle.
    void run() {
        std::unique_lock its_lock(mutex_);
        condition_.wait(its_lock, [this] { return blocked_; });

        offer();
        while (running_)
            std::this_thread::sleep_for(std::chrono::milliseconds(200));
    }

    // Publish a simulated obstacle distance (2 bytes, centimetres, big-endian)
    // that closes in from 5.00 m toward the car, then resets.
    void notify() {
        vsomeip::byte_t its_data[2];

        while (running_) {
            std::unique_lock its_lock(notify_mutex_);
            notify_condition_.wait(its_lock, [this] { return is_offered_ || !running_; });

            while (is_offered_ && running_) {
                its_data[0] = static_cast<vsomeip::byte_t>((distance_cm_ >> 8) & 0xFF);
                its_data[1] = static_cast<vsomeip::byte_t>(distance_cm_ & 0xFF);

                {
                    std::scoped_lock its_pl_lock(payload_mutex_);
                    payload_->set_data(its_data, sizeof(its_data));
                    std::cout << "LIDAR: obstacle distance = " << std::dec << std::fixed << std::setprecision(2)
                              << (distance_cm_ / 100.0) << " m  -> notify event 0x" << std::hex << SAMPLE_EVENT_ID
                              << std::dec << std::endl;
                    app_->notify(SAMPLE_SERVICE_ID, SAMPLE_INSTANCE_ID, SAMPLE_EVENT_ID, payload_);
                }

                distance_cm_ = (distance_cm_ <= 50) ? 500 : static_cast<uint16_t>(distance_cm_ - 25);
                std::this_thread::sleep_for(std::chrono::milliseconds(cycle_));
            }
        }
    }

private:
    std::shared_ptr<vsomeip::application> app_;
    bool is_registered_;
    uint32_t cycle_;

    std::mutex mutex_;
    std::condition_variable condition_;
    bool blocked_;
    bool running_;

    std::mutex notify_mutex_;
    std::condition_variable notify_condition_;
    bool is_offered_;

    uint16_t distance_cm_;

    std::mutex payload_mutex_;
    std::shared_ptr<vsomeip::payload> payload_;

    // blocked_ / is_offered_ must be initialized before starting the threads!
    std::thread offer_thread_;
    std::thread notify_thread_;
};

int main(int argc, char** argv) {
    uint32_t cycle = 1000; // publish every 1s by default

    std::string cycle_arg("--cycle");

    for (int i = 1; i < argc; i++) {
        if (cycle_arg == argv[i] && i + 1 < argc) {
            i++;
            std::stringstream converter;
            converter << argv[i];
            converter >> cycle;
        }
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

    lidar_service its_sample(cycle);
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
